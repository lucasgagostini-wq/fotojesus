import type { VercelRequest } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { MercadoPagoConfig, Payment } from "mercadopago";
import {
  getCheckoutQuote,
  type CheckoutPriceKey,
} from "../../src/lib/checkout-pricing.js";

type RequiredEnv = {
  accessToken: string;
  supabaseServiceRoleKey: string;
  supabaseUrl: string;
  webhookSecret?: string;
};

export class ClientInputError extends Error {}

export type OrderStatusRecord = {
  id: string;
  mp_payment_id: null | string;
  mp_status: string;
  paid_at: null | string;
  status_token: string;
};

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
  if (digits.length !== 11) {
    throw new ClientInputError("Invalid phone number");
  }

  return digits;
}

export function parseCheckoutRequest(body: unknown) {
  const raw = (body ?? {}) as {
    phoneNumber?: unknown;
    priceKey?: unknown;
    selectedStyleIds?: unknown;
  };

  if (
    typeof raw.priceKey !== "string" ||
    !Array.isArray(raw.selectedStyleIds) ||
    raw.selectedStyleIds.some((styleId) => typeof styleId !== "number")
  ) {
    throw new ClientInputError("Missing required fields");
  }

  const phoneNumber = normalizePhoneNumber(raw.phoneNumber);
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
    phoneNumber,
    priceKey,
    quote,
  };
}

export async function syncOrderPaymentStatus(params: {
  order: OrderStatusRecord;
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

  if (
    paymentId !== order.mp_payment_id ||
    nextStatus !== order.mp_status ||
    nextPaidAt !== order.paid_at
  ) {
    const { data, error } = await supabase
      .from("orders")
      .update({
        mp_payment_id: paymentId,
        mp_status: nextStatus,
        paid_at: nextPaidAt,
      })
      .eq("id", order.id)
      .select("id, mp_payment_id, mp_status, paid_at, status_token")
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "Failed to persist payment status");
    }

    return {
      paidAt: data.paid_at,
      paymentId: data.mp_payment_id,
      status: data.mp_status,
    };
  }

  return { paidAt: nextPaidAt, paymentId, status: nextStatus };
}
