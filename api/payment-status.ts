import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  createMercadoPagoPaymentClient,
  createSupabaseAdminClient,
  getRequiredEnv,
  syncOrderPaymentStatus,
} from "./_lib/payment-flow.js";
import { getOrderByAccess, writeOrderEvent } from "./_lib/orders.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const id = req.query.id;
  const token = req.query.token;
  const orderId = typeof id === "string" ? id : id?.[0];
  const accessToken = typeof token === "string" ? token : token?.[0];

  if (!orderId || !accessToken) {
    return res.status(400).json({ error: "Missing id or token" });
  }

  res.setHeader("Cache-Control", "no-store");

  try {
    const env = getRequiredEnv();
    const supabase = createSupabaseAdminClient(env);
    const paymentClient = createMercadoPagoPaymentClient(env);
    const order = await getOrderByAccess({
      accessToken,
      orderId,
      supabase,
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    const nextOrder =
      order.mp_status === "pending"
        ? await syncOrderPaymentStatus({
            order,
            paymentClient,
            supabase,
          })
        : {
            paidAt: order.paid_at,
            paymentId: order.mp_payment_id,
            status: order.mp_status,
          };

    await writeOrderEvent({
      eventType: "payment_status_polled",
      orderId: order.id,
      payload: { status: nextOrder.status },
      supabase,
    });

    const refreshedOrder = await getOrderByAccess({
      accessToken,
      orderId,
      supabase,
    });

    return res.status(200).json({
      orderStatus: refreshedOrder?.order_status ?? order.order_status,
      paidAt: nextOrder.paidAt,
      status: nextOrder.status,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("[payment-status]", err);
    return res.status(500).json({ error: message });
  }
}
