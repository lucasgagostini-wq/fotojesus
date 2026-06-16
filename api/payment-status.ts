import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  createMercadoPagoPaymentClient,
  createSupabaseAdminClient,
  getRequiredEnv,
  syncOrderPaymentStatus,
  type OrderStatusRecord,
} from "./_lib/payment-flow.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const id = req.query.id;
  const token = req.query.token;
  const orderId = typeof id === "string" ? id : id?.[0];
  const statusToken = typeof token === "string" ? token : token?.[0];

  if (!orderId || !statusToken) {
    return res.status(400).json({ error: "Missing id or token" });
  }

  res.setHeader("Cache-Control", "no-store");

  try {
    const env = getRequiredEnv();
    const supabase = createSupabaseAdminClient(env);
    const paymentClient = createMercadoPagoPaymentClient(env);

    const { data: order, error } = await supabase
      .from("orders")
      .select("id, mp_payment_id, mp_status, paid_at, status_token")
      .eq("id", orderId)
      .eq("status_token", statusToken)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    const nextOrder =
      order.mp_status === "pending"
        ? await syncOrderPaymentStatus({
            order: order as OrderStatusRecord,
            paymentClient,
            supabase,
          })
        : {
            paidAt: order.paid_at,
            paymentId: order.mp_payment_id,
            status: order.mp_status,
          };

    return res.status(200).json({
      paidAt: nextOrder.paidAt,
      status: nextOrder.status,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("[payment-status]", err);
    return res.status(500).json({ error: message });
  }
}
