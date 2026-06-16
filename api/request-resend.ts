import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  ClientInputError,
  createSupabaseAdminClient,
  getRequiredEnv,
} from "./_lib/payment-flow.js";
import { getOrderByAccess, writeOrderEvent } from "./_lib/orders.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const body = (req.body ?? {}) as {
      accessToken?: unknown;
      orderId?: unknown;
    };

    if (typeof body.orderId !== "string" || typeof body.accessToken !== "string") {
      throw new ClientInputError("Missing order credentials");
    }

    const env = getRequiredEnv();
    const supabase = createSupabaseAdminClient(env);
    const order = await getOrderByAccess({
      accessToken: body.accessToken,
      orderId: body.orderId,
      supabase,
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    const destination = order.phone;
    if (!destination) {
      throw new ClientInputError("Order is missing a delivery destination");
    }

    const now = new Date().toISOString();
    const dedupeKey = `whatsapp:${order.id}:${destination}`;
    const { error } = await supabase.from("order_deliveries").upsert(
      {
        channel: "whatsapp",
        dedupe_key: dedupeKey,
        destination,
        last_error: null,
        order_id: order.id,
        requested_at: now,
        status: "retry_requested",
      },
      { onConflict: "dedupe_key", ignoreDuplicates: false },
    );

    if (error) {
      throw new Error(error.message);
    }

    await supabase
      .from("orders")
      .update({
        order_status:
          order.order_status === "delivery_sent" ? order.order_status : "delivery_retry_requested",
      })
      .eq("id", order.id);

    await writeOrderEvent({
      eventType: "delivery_retry_requested",
      orderId: order.id,
      payload: { channel: "whatsapp" },
      supabase,
    });

    return res.status(200).json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    if (err instanceof ClientInputError) {
      return res.status(400).json({ error: message });
    }

    console.error("[request-resend]", err);
    return res.status(500).json({ error: message });
  }
}
