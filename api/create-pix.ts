import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  ClientInputError,
  createMercadoPagoPaymentClient,
  createSupabaseAdminClient,
  getPublicAppBaseUrl,
  getRequiredEnv,
  parseCheckoutRequest,
} from "./_lib/payment-flow.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const env = getRequiredEnv();
    const { phoneNumber, priceKey, quote } = parseCheckoutRequest(req.body);
    const supabase = createSupabaseAdminClient(env);
    const payment = createMercadoPagoPaymentClient(env);
    const orderId = crypto.randomUUID();
    const statusToken = crypto.randomUUID().replace(/-/g, "");

    const { data: order, error: insertError } = await supabase
      .from("orders")
      .insert({
        id: orderId,
        phone: phoneNumber,
        amount: quote.amount,
        label: quote.label,
        price_key: priceKey,
        selected_styles: quote.selectedStyleIds,
        status_token: statusToken,
        styles: quote.purchasedStyleIds,
      })
      .select("id, status_token")
      .single();

    if (insertError || !order) {
      throw new Error(insertError?.message ?? "Failed to create order");
    }

    let result;

    try {
      result = await payment.create({
        body: {
          description: `FotoJesus - ${quote.label}`,
          external_reference: order.id,
          metadata: {
            order_id: order.id,
            price_key: priceKey,
            purchased_styles: quote.purchasedStyleIds,
            selected_styles: quote.selectedStyleIds,
          },
          notification_url: `${getPublicAppBaseUrl(req)}/api/webhook`,
          payer: {
            email: "pagador@fotojesus.com.br",
            first_name: "Cliente",
          },
          payment_method_id: "pix",
          transaction_amount: quote.amount,
        },
        requestOptions: { idempotencyKey: order.id },
      });
    } catch (paymentError) {
      await supabase
        .from("orders")
        .update({ mp_status: "creation_failed" })
        .eq("id", order.id);

      throw paymentError;
    }

    const pixCode = result.point_of_interaction?.transaction_data?.qr_code ?? null;
    const qrBase64 = result.point_of_interaction?.transaction_data?.qr_code_base64 ?? null;
    if (!result.id) {
      throw new Error("Mercado Pago did not return a payment id");
    }

    const paymentId = String(result.id);
    const { data: updatedOrder, error: updateError } = await supabase
      .from("orders")
      .update({
        mp_payment_id: paymentId,
        mp_status: result.status ?? "pending",
        paid_at: result.status === "approved" ? result.date_approved ?? new Date().toISOString() : null,
        pix_code: pixCode,
        pix_qr_base64: qrBase64,
      })
      .eq("id", order.id)
      .select("id")
      .single();

    if (updateError || !updatedOrder) {
      console.error("[create-pix] Failed to persist PIX details", updateError);
    }

    return res.status(200).json({
      orderId: order.id,
      paymentId,
      pixCode,
      qrBase64,
      statusToken: order.status_token,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    if (err instanceof ClientInputError) {
      return res.status(400).json({ error: message });
    }

    console.error("[create-pix]", err);
    return res.status(500).json({ error: message });
  }
}
