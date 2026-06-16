import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createSupabaseAdminClient, getRequiredEnv, isDev } from "./_lib/payment-flow.js";
import {
  buildOrderAccessResponse,
  getOrderByAccess,
  writeOrderEvent,
} from "./_lib/orders.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const id = typeof req.query.id === "string" ? req.query.id : req.query.id?.[0];
  const token =
    typeof req.query.token === "string" ? req.query.token : req.query.token?.[0];

  if (!id || !token) {
    return res.status(400).json({ error: "Missing id or token" });
  }

  res.setHeader("Cache-Control", "no-store");

  if (isDev()) {
    console.warn("[DEV MOCK] order-access — retornando sessão mock");
    return res.status(200).json({
      order: {
        accessToken: typeof token === "string" ? token : "dev_token_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        amount: null,
        createdAt: new Date().toISOString(),
        deliveries: [],
        id: typeof id === "string" ? id : "devorder0-0000-0000-0000-000000000000",
        label: null,
        mpStatus: "",
        orderStatus: "photo_uploaded",
        paidAt: null,
        phoneNumber: null,
        pixCode: null,
        priceKey: null,
        purchasedStyleIds: [],
        qrBase64: null,
        recoveryCode: "12345678",
        results: [],
        selectedStyleIds: [],
        sourcePreviewUrl: null,
      },
    });
  }

  try {
    const env = getRequiredEnv();
    const supabase = createSupabaseAdminClient(env);
    const order = await getOrderByAccess({
      accessToken: token,
      orderId: id,
      supabase,
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    const { error: touchError } = await supabase
      .from("orders")
      .update({ last_accessed_at: new Date().toISOString() })
      .eq("id", order.id);

    if (touchError) {
      console.error("[order-access] Failed to touch access timestamp", touchError);
    }

    await writeOrderEvent({
      eventType: "order_accessed",
      orderId: order.id,
      payload: { via: "access_token" },
      supabase,
    });

    const payload = await buildOrderAccessResponse({ order, supabase });
    return res.status(200).json(payload);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("[order-access]", err);
    return res.status(500).json({ error: message });
  }
}
