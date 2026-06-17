import type { VercelRequest } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { MercadoPagoConfig, Payment } from "mercadopago";
import {
  getCheckoutQuote,
  type CheckoutPriceKey,
} from "../../src/lib/checkout-pricing.js";
import {
  isValidBrWhatsApp,
  isValidEmail,
  normalizeEmail,
} from "../../src/lib/contact-validation.js";
import {
  deriveOrderStatusFromPayment,
  ensurePaidOrderArtifacts,
  type OrderRecord,
  writeOrderEvent,
} from "./orders.js";

type RequiredEnv = {
  accessToken: string;
  supabaseServiceRoleKey: string;
  supabaseUrl: string;
  webhookSecret?: string;
};

export class ClientInputError extends Error {}

export type CheckoutRequestInput = {
  accessToken: string;
  orderId: string;
  phoneNumber: string;
  email: null | string;
  priceKey: CheckoutPriceKey;
  quote: ReturnType<typeof getCheckoutQuote>;
};

export function isDev(): boolean {
  return (
    !process.env.MP_ACCESS_TOKEN ||
    !process.env.SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export function getRequiredEnv(): RequiredEnv {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!accessToken || !supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Server misconfiguration: missing env vars");
  }

  return {
    accessToken,
    supabaseServiceRoleKey,
    supabaseUrl,
    webhookSecret: process.env.MP_WEBHOOK_SECRET,
  };
}

export function createMercadoPagoPaymentClient(env: RequiredEnv): Payment {
  return new Payment(new MercadoPagoConfig({ accessToken: env.accessToken }));
}

export function createSupabaseAdminClient(env: RequiredEnv) {
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function getPublicAppBaseUrl(req: VercelRequest): string {
  const forwardedHost = req.headers["x-forwarded-host"];
  const hostHeader = Array.isArray(forwardedHost)
    ? forwardedHost[0]
    : forwardedHost ?? req.headers.host;
  const forwardedProto = req.headers["x-forwarded-proto"];
  const protocol = Array.isArray(forwardedProto)
    ? forwardedProto[0]
    : forwardedProto ?? "https";

  if (!hostHeader) {
    throw new Error("Missing request host");
  }

  return `${protocol}://${hostHeader}`;
}

export function normalizePhoneNumber(rawPhoneNumber: unknown): string {
  if (typeof rawPhoneNumber !== "string") {
    throw new ClientInputError("Missing required fields");
  }

  const digits = rawPhoneNumber.replace(/\D/g, "");
  if (!isValidBrWhatsApp(digits)) {
    throw new ClientInputError("Invalid phone number");
  }

  return digits;
}

export function parseCheckoutRequest(body: unknown): CheckoutRequestInput {
  const raw = (body ?? {}) as {
    accessToken?: unknown;
    orderId?: unknown;
    phoneNumber?: unknown;
    email?: unknown;
    priceKey?: unknown;
    selectedStyleIds?: unknown;
  };

  if (
    typeof raw.accessToken !== "string" ||
    typeof raw.orderId !== "string" ||
    typeof raw.priceKey !== "string" ||
    !Array.isArray(raw.selectedStyleIds) ||
    raw.selectedStyleIds.some((styleId) => typeof styleId !== "number")
  ) {
    throw new ClientInputError("Missing required fields");
  }

  const phoneNumber = normalizePhoneNumber(raw.phoneNumber);
  // E-mail é leniente: NUNCA lança. Se ausente/inválido, persiste null — jamais
  // bloqueia o checkout (a validação forte de e-mail acontece no frontend).
  const email =
    typeof raw.email === "string" && isValidEmail(raw.email)
      ? normalizeEmail(raw.email)
      : null;
  const priceKey = raw.priceKey as CheckoutPriceKey;
  let quote;

  try {
    quote = getCheckoutQuote(priceKey, raw.selectedStyleIds);
  } catch (error) {
    if (error instanceof Error) {
      throw new ClientInputError(error.message);
    }

    throw error;
  }

  return {
    accessToken: raw.accessToken,
    orderId: raw.orderId,
    phoneNumber,
    email,
    priceKey,
    quote,
  };
}

export async function syncOrderPaymentStatus(params: {
  order: Pick<
    OrderRecord,
    "id" | "mp_payment_id" | "mp_status" | "order_status" | "paid_at" | "phone" | "purchased_styles"
  >;
  paymentClient: Payment;
  supabase: ReturnType<typeof createSupabaseAdminClient>;
}) {
  const { order, paymentClient, supabase } = params;

  let paymentId = order.mp_payment_id;
  if (!paymentId) {
    const searchResult = await paymentClient.search({
      options: {
        criteria: "desc",
        external_reference: order.id,
        sort: "date_created",
      },
    });

    const latestPayment = searchResult.results?.[0];
    if (!latestPayment?.id) {
      return { paidAt: order.paid_at, paymentId: null, status: order.mp_status };
    }

    paymentId = String(latestPayment.id);
  }

  const payment = await paymentClient.get({ id: paymentId });
  const nextStatus = payment.status ?? order.mp_status;
  const nextPaidAt =
    nextStatus === "approved"
      ? payment.date_approved ?? order.paid_at ?? new Date().toISOString()
      : order.paid_at;
  const nextOrderStatus = deriveOrderStatusFromPayment(order.order_status, nextStatus);

  if (
    paymentId !== order.mp_payment_id ||
    nextStatus !== order.mp_status ||
    nextPaidAt !== order.paid_at ||
    nextOrderStatus !== order.order_status
  ) {
    const { data, error } = await supabase
      .from("orders")
      .update({
        mp_payment_id: paymentId,
        mp_status: nextStatus,
        order_status: nextOrderStatus,
        paid_at: nextPaidAt,
      })
      .eq("id", order.id)
      .select(
        "id, access_token, recovery_code, order_status, phone, amount, label, price_key, selected_styles, purchased_styles, mp_payment_id, mp_status, pix_code, qr_base64, created_at, paid_at, source_preview_path",
      )
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "Failed to persist payment status");
    }

    if (nextStatus === "approved") {
      await ensurePaidOrderArtifacts({
        order: data as OrderRecord,
        supabase,
      });
    }

    await writeOrderEvent({
      eventType: "payment_status_synced",
      orderId: order.id,
      payload: {
        mpPaymentId: paymentId,
        mpStatus: nextStatus,
        orderStatus: nextOrderStatus,
      },
      supabase,
    });

    return {
      paidAt: data.paid_at,
      paymentId: data.mp_payment_id,
      status: data.mp_status,
    };
  }

  if (nextStatus === "approved") {
    await ensurePaidOrderArtifacts({
      order,
      supabase,
    });
  }

  return { paidAt: nextPaidAt, paymentId, status: nextStatus };
}
