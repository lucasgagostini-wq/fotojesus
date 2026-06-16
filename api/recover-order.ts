import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  ClientInputError,
  createSupabaseAdminClient,
  getRequiredEnv,
  normalizePhoneNumber,
} from "./_lib/payment-flow.js";
import {
  buildOrderAccessResponse,
  type OrderRecord,
  writeOrderEvent,
} from "./_lib/orders.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const body = (req.body ?? {}) as {
      phoneNumber?: unknown;
      recoveryCode?: unknown;
    };

    if (typeof body.recoveryCode !== "string" || body.recoveryCode.trim().length < 6) {
      throw new ClientInputError("Invalid recovery code");
    }

    const phone = normalizePhoneNumber(body.phoneNumber);
    const recoveryCode = body.recoveryCode.trim();
    const env = getRequiredEnv();
    const supabase = createSupabaseAdminClient(env);

    const { data: order, error } = await supabase
      .from("orders")
      .select(
        "id, access_token, recovery_code, order_status, phone, amount, label, price_key, selected_styles, purchased_styles, mp_payment_id, mp_status, pix_code, qr_base64, created_at, paid_at, source_preview_path",
      )
      .eq("phone", phone)
      .eq("recovery_code", recoveryCode)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    await supabase
      .from("orders")
      .update({ last_recovered_at: new Date().toISOString() })
      .eq("id", order.id);

    await writeOrderEvent({
      eventType: "order_recovered",
      orderId: order.id,
      payload: { via: "phone_and_recovery_code" },
      supabase,
    });

    const payload = await buildOrderAccessResponse({
      order: order as OrderRecord,
      supabase,
    });
    return res.status(200).json(payload);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    if (err instanceof ClientInputError) {
      return res.status(400).json({ error: message });
    }

    console.error("[recover-order]", err);
    return res.status(500).json({ error: message });
  }
}
