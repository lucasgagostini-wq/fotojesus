import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  createMercadoPagoPaymentClient,
  createSupabaseAdminClient,
  getRequiredEnv,
  syncOrderPaymentStatus,
} from "./_lib/payment-flow.js";
import { normalizeStyleIds, writeOrderEvent } from "./_lib/orders.js";

async function notifyDiscord(params: {
  amount: null | number;
  label: null | string;
  orderId: string;
  phone: null | string;
  purchasedStyleIds: number[];
}) {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return;

  const { amount, label, orderId, phone, purchasedStyleIds } = params;
  const stylesText = purchasedStyleIds.length > 0 ? `Estilos ${purchasedStyleIds.join(", ")}` : "—";
  const amountText = amount != null ? `R$ ${amount.toFixed(2).replace(".", ",")}` : "—";

  const payload = {
    embeds: [
      {
        color: 0x25d366,
        fields: [
          { inline: true, name: "💰 Valor", value: amountText },
          { inline: true, name: "📦 Produto", value: label ?? "—" },
          { inline: true, name: "🎨 Estilos", value: stylesText },
          { inline: false, name: "📱 WhatsApp", value: phone ? `+55 ${phone}` : "—" },
          { inline: false, name: "🔑 Order ID", value: `\`${orderId}\`` },
        ],
        title: "🎉 Nova venda FotoJesus!",
      },
    ],
  };

  try {
    await fetch(url, {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
  } catch (err) {
    console.error("[webhook] Discord notification failed", err);
  }
}

function getWebhookPaymentId(req: VercelRequest): null | string {
  const queryDataId = req.query["data.id"];
  const body = (req.body ?? {}) as { data?: { id?: string }; "data.id"?: string };

  if (typeof queryDataId === "string") return queryDataId;
  if (Array.isArray(queryDataId)) return queryDataId[0] ?? null;
  if (typeof body.data?.id === "string") return body.data.id;
  if (typeof body["data.id"] === "string") return body["data.id"];
  return null;
}

function validateSignature(req: VercelRequest, secret: string): boolean {
  const xSignature = req.headers["x-signature"];
  const xRequestId = req.headers["x-request-id"];

  if (typeof xSignature !== "string" || typeof xRequestId !== "string") return false;

  const parts = Object.fromEntries(
    xSignature.split(",").map((part) => {
      const index = part.indexOf("=");
      const key = part.slice(0, index).trim();
      const value = part.slice(index + 1).trim();
      return [key, value];
    }),
  );

  const timestamp = parts.ts;
  const expectedSignature = parts.v1;
  const paymentId = getWebhookPaymentId(req);

  if (!timestamp || !expectedSignature || !paymentId) return false;

  const manifest = `id:${paymentId};request-id:${xRequestId};ts:${timestamp};`;
  const actualSignature = createHmac("sha256", secret).update(manifest).digest("hex");
  if (actualSignature.length !== expectedSignature.length) return false;

  return timingSafeEqual(
    Buffer.from(actualSignature, "utf8"),
    Buffer.from(expectedSignature, "utf8"),
  );
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const env = getRequiredEnv();
    const webhookSecret = env.webhookSecret;
    const isProduction = process.env.NODE_ENV === "production";

    if (isProduction && !webhookSecret) {
      return res.status(500).json({ error: "Server misconfiguration: missing env vars" });
    }

    if (webhookSecret && !validateSignature(req, webhookSecret)) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    const body = (req.body ?? {}) as {
      action?: string;
      data?: { id?: string };
      topic?: string;
      type?: string;
    };
    const eventType = body.type ?? body.topic ?? body.action?.split(".")[0];

    if (eventType !== "payment") {
      return res.status(200).json({ ok: true });
    }

    const paymentId = getWebhookPaymentId(req);
    if (!paymentId) {
      return res.status(400).json({ error: "Missing payment id" });
    }

    const supabase = createSupabaseAdminClient(env);
    const paymentClient = createMercadoPagoPaymentClient(env);
    const paymentData = await paymentClient.get({ id: paymentId });
    const externalReference = paymentData.external_reference;

    if (!externalReference) {
      throw new Error("Payment is missing external_reference");
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(
        "id, access_token, recovery_code, order_status, phone, amount, label, price_key, selected_styles, purchased_styles, mp_payment_id, mp_status, pix_code, qr_base64, created_at, paid_at, source_original_path, source_preview_path",
      )
      .eq("id", externalReference)
      .single();

    if (orderError || !order) {
      throw new Error(orderError?.message ?? "Order not found for payment");
    }

    await supabase
      .from("orders")
      .update({ last_webhook_at: new Date().toISOString() })
      .eq("id", externalReference);

    const syncResult = await syncOrderPaymentStatus({
      order: {
        ...(order as Parameters<typeof syncOrderPaymentStatus>[0]["order"]),
        mp_payment_id: String(paymentData.id),
      },
      paymentClient,
      supabase,
    });

    if (syncResult.status === "approved") {
      await notifyDiscord({
        amount: order.amount,
        label: order.label,
        orderId: externalReference,
        phone: order.phone,
        purchasedStyleIds: normalizeStyleIds(order.purchased_styles),
      });
    }

    await writeOrderEvent({
      eventType: "mercado_pago_webhook_processed",
      orderId: externalReference,
      payload: {
        eventType,
        mpPaymentId: paymentId,
        mpStatus: paymentData.status ?? null,
      },
      supabase,
    });

    return res.status(200).json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("[webhook]", err);
    return res.status(500).json({ error: message });
  }
}
