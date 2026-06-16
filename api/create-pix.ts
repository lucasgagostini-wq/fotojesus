import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  ClientInputError,
  createMercadoPagoPaymentClient,
  createSupabaseAdminClient,
  getPublicAppBaseUrl,
  getRequiredEnv,
  isDev,
  parseCheckoutRequest,
} from "./_lib/payment-flow.js";
import {
  getOrderByAccess,
  normalizeStyleIds,
  writeOrderEvent,
} from "./_lib/orders.js";
import { notifyFlowError, notifyPixGenerated } from "./_lib/discord.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();

  if (isDev()) {
    console.warn("[DEV MOCK] create-pix — env vars ausentes, retornando mock");
    const body = (req.body ?? {}) as { accessToken?: string; orderId?: string };
    const accessToken = typeof body.accessToken === "string" ? body.accessToken : "dev_token_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
    const orderId = typeof body.orderId === "string" ? body.orderId : "devorder0-0000-0000-0000-000000000000";
    return res.status(200).json({
      accessToken,
      orderId,
      paymentId: "DEV-PAY-00000001",
      pixCode: "00020126580014br.gov.bcb.pix0136devpixkeyfotojesuslocaltesting00005204000053039865802BR5924FotoJesus Dev Local6009SAOPAULO62070503***6304ABCD",
      qrBase64: null,
      recoveryCode: "12345678",
      status: "pending",
    });
  }

  try {
    const env = getRequiredEnv();
    const { accessToken, orderId, phoneNumber, priceKey, quote } = parseCheckoutRequest(req.body);
    const supabase = createSupabaseAdminClient(env);
    const payment = createMercadoPagoPaymentClient(env);
    const order = await getOrderByAccess({
      accessToken,
      orderId,
      supabase,
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (!order.source_original_path) {
      throw new ClientInputError("Upload a photo before creating the PIX");
    }

    const purchasedStyleIds = normalizeStyleIds(order.purchased_styles);
    const hasSameCheckout =
      order.price_key === priceKey &&
      JSON.stringify(normalizeStyleIds(order.selected_styles)) ===
        JSON.stringify(quote.selectedStyleIds) &&
      JSON.stringify(purchasedStyleIds) === JSON.stringify(quote.purchasedStyleIds);

    if (order.mp_status === "approved") {
      return res.status(200).json({
        accessToken: order.access_token,
        orderId: order.id,
        paymentId: order.mp_payment_id,
        pixCode: order.pix_code,
        qrBase64: order.qr_base64,
        recoveryCode: order.recovery_code,
        status: order.mp_status,
      });
    }

    if (order.mp_status === "pending" && order.mp_payment_id && order.pix_code && hasSameCheckout) {
      return res.status(200).json({
        accessToken: order.access_token,
        orderId: order.id,
        paymentId: order.mp_payment_id,
        pixCode: order.pix_code,
        qrBase64: order.qr_base64,
        recoveryCode: order.recovery_code,
        status: order.mp_status,
      });
    }

    const { error: prepareError } = await supabase
      .from("orders")
      .update({
        amount: quote.amount,
        label: quote.label,
        last_error: null,
        order_status: "payment_pending",
        payment_requested_at: new Date().toISOString(),
        phone: phoneNumber,
        price_key: priceKey,
        purchased_styles: quote.purchasedStyleIds,
        selected_styles: quote.selectedStyleIds,
        styles: quote.purchasedStyleIds,
      })
      .eq("id", order.id);

    if (prepareError) {
      throw new Error(prepareError.message);
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
            recovery_code: order.recovery_code,
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
        .update({ last_error: "Mercado Pago payment creation failed", mp_status: "creation_failed" })
        .eq("id", order.id);

      throw paymentError;
    }

    const pixCode = result.point_of_interaction?.transaction_data?.qr_code ?? null;
    const qrBase64 = result.point_of_interaction?.transaction_data?.qr_code_base64 ?? null;
    if (!result.id) {
      throw new Error("Mercado Pago did not return a payment id");
    }

    const paymentId = String(result.id);
    const { error: updateError } = await supabase
      .from("orders")
      .update({
        mp_payment_id: paymentId,
        mp_status: result.status ?? "pending",
        order_status: "payment_pending",
        paid_at: result.status === "approved" ? result.date_approved ?? new Date().toISOString() : null,
        pix_code: pixCode,
        qr_base64: qrBase64,
      })
      .eq("id", order.id);

    if (updateError) {
      console.error("[create-pix] Failed to persist PIX details", updateError);
    }

    await writeOrderEvent({
      eventType: "pix_created",
      orderId: order.id,
      payload: {
        mpPaymentId: paymentId,
        priceKey,
        purchasedStyleIds: quote.purchasedStyleIds,
        selectedStyleIds: quote.selectedStyleIds,
      },
      supabase,
    });

    await notifyPixGenerated({
      amount: quote.amount,
      orderId: order.id,
      paymentId,
      phone: phoneNumber,
      selectedStyleIds: quote.selectedStyleIds,
    });

    return res.status(200).json({
      accessToken: order.access_token,
      orderId: order.id,
      paymentId,
      pixCode,
      qrBase64,
      recoveryCode: order.recovery_code,
      status: result.status ?? "pending",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    if (err instanceof ClientInputError) {
      return res.status(400).json({ error: message });
    }

    console.error("[create-pix]", err);
    await notifyFlowError({ endpoint: "create-pix", message });
    return res.status(500).json({ error: message });
  }
}
