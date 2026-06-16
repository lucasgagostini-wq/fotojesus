import { randomBytes, randomInt, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ORDER_RESULTS_BUCKET,
  ORDER_SOURCE_BUCKET,
  type OrderAccessResponse,
  type OrderDeliverySummary,
  type OrderResultSummary,
} from "../../src/lib/order-contract.js";
import {
  isPaidOrderStatus,
  type OrderDeliveryStatus,
  type OrderResultStatus,
  type OrderStatus,
} from "../../src/lib/order-status.js";

type Json = boolean | null | number | string | Json[] | { [key: string]: Json };

export type OrderRecord = {
  access_token: string;
  amount: null | number;
  created_at: string;
  id: string;
  label: null | string;
  mp_payment_id: null | string;
  mp_status: string;
  order_status: OrderStatus;
  paid_at: null | string;
  phone: null | string;
  pix_code: null | string;
  price_key: null | string;
  purchased_styles: Json | null;
  qr_base64: null | string;
  recovery_code: null | string;
  selected_styles: Json | null;
  source_original_path: null | string;
  source_preview_path: null | string;
};

type OrderResultRow = {
  completed_at: null | string;
  last_error: null | string;
  preview_path: null | string;
  result_path: null | string;
  status: OrderResultStatus;
  style_id: number;
};

type OrderDeliveryRow = {
  attempts: number | null;
  channel: string;
  destination: null | string;
  last_attempt_at: null | string;
  last_error: null | string;
  sent_at: null | string;
  status: OrderDeliveryStatus;
};

type UploadDraftOrderParams = {
  existingAccessToken?: string;
  existingOrderId?: string;
  mimeType: string;
  originalBytes: Uint8Array;
  previewBytes: Uint8Array;
  sha256: string;
  supabase: SupabaseClient;
};

export function createOpaqueToken(length = 24): string {
  return randomBytes(length).toString("hex");
}

export function createRecoveryCode(): string {
  return randomInt(0, 100_000_000).toString().padStart(8, "0");
}

export function getOrderSourceOriginalPath(orderId: string): string {
  return `orders/${orderId}/source/original.jpg`;
}

export function getOrderSourcePreviewPath(orderId: string): string {
  return `orders/${orderId}/source/preview.jpg`;
}

export function getOrderResultPath(orderId: string, styleId: number): string {
  return `orders/${orderId}/results/style-${styleId}/final.jpg`;
}

export function getOrderResultPreviewPath(orderId: string, styleId: number): string {
  return `orders/${orderId}/results/style-${styleId}/preview.jpg`;
}

export function normalizeStyleIds(value: Json | null): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const validStyleIds = new Set<number>();
  for (const item of value) {
    if (typeof item === "number" && Number.isInteger(item)) {
      validStyleIds.add(item);
    }
  }

  return [...validStyleIds].sort((left, right) => left - right);
}

export function deriveOrderStatusFromPayment(
  currentStatus: OrderStatus,
  mercadoPagoStatus: string,
): OrderStatus {
  if (mercadoPagoStatus === "approved") {
    return isPaidOrderStatus(currentStatus) ? currentStatus : "payment_approved";
  }

  if (
    mercadoPagoStatus === "cancelled" ||
    mercadoPagoStatus === "rejected" ||
    mercadoPagoStatus === "refunded" ||
    mercadoPagoStatus === "charged_back"
  ) {
    return isPaidOrderStatus(currentStatus) ? currentStatus : "cancelled";
  }

  if (
    currentStatus === "draft" ||
    currentStatus === "photo_uploaded" ||
    currentStatus === "payment_pending"
  ) {
    return "payment_pending";
  }

  return currentStatus;
}

export async function writeOrderEvent(params: {
  eventType: string;
  orderId: string;
  payload?: Json;
  supabase: SupabaseClient;
}) {
  const { eventType, orderId, payload = {}, supabase } = params;

  const { error } = await supabase.from("order_events").insert({
    event_type: eventType,
    order_id: orderId,
    payload,
  });

  if (error) {
    console.error("[order-events]", error);
  }
}

export async function getOrderByAccess(params: {
  accessToken: string;
  orderId: string;
  supabase: SupabaseClient;
}) {
  const { accessToken, orderId, supabase } = params;

  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, access_token, recovery_code, order_status, phone, amount, label, price_key, selected_styles, purchased_styles, mp_payment_id, mp_status, pix_code, qr_base64, created_at, paid_at, source_original_path, source_preview_path",
    )
    .eq("id", orderId)
    .eq("access_token", accessToken)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as OrderRecord | null) ?? null;
}

export async function createOrUpdateDraftOrderWithUpload(
  params: UploadDraftOrderParams,
) {
  const {
    existingAccessToken,
    existingOrderId,
    mimeType,
    originalBytes,
    previewBytes,
    sha256,
    supabase,
  } = params;

  let orderId = existingOrderId;
  let accessToken = existingAccessToken;
  let recoveryCode: null | string = null;

  if (orderId && accessToken) {
    const existingOrder = await getOrderByAccess({
      accessToken,
      orderId,
      supabase,
    });

    if (!existingOrder) {
      throw new Error("Order not found");
    }

    if (isPaidOrderStatus(existingOrder.order_status)) {
      throw new Error("Paid orders cannot replace the source photo");
    }

    recoveryCode = existingOrder.recovery_code;
  } else {
    orderId = randomUUID();
    accessToken = createOpaqueToken();
    recoveryCode = createRecoveryCode();

    const { error } = await supabase.from("orders").insert({
      access_token: accessToken,
      id: orderId,
      order_status: "draft",
      recovery_code: recoveryCode,
    });

    if (error) {
      throw new Error(error.message);
    }
  }

  const originalPath = getOrderSourceOriginalPath(orderId);
  const previewPath = getOrderSourcePreviewPath(orderId);

  const { error: originalUploadError } = await supabase.storage
    .from(ORDER_SOURCE_BUCKET)
    .upload(originalPath, originalBytes, {
      cacheControl: "31536000",
      contentType: mimeType,
      upsert: true,
    });

  if (originalUploadError) {
    throw new Error(originalUploadError.message);
  }

  const { error: previewUploadError } = await supabase.storage
    .from(ORDER_SOURCE_BUCKET)
    .upload(previewPath, previewBytes, {
      cacheControl: "31536000",
      contentType: "image/jpeg",
      upsert: true,
    });

  if (previewUploadError) {
    throw new Error(previewUploadError.message);
  }

  const { data: order, error: updateError } = await supabase
    .from("orders")
    .update({
      last_error: null,
      order_status: "photo_uploaded",
      source_bucket: ORDER_SOURCE_BUCKET,
      source_mime_type: mimeType,
      source_original_path: originalPath,
      source_preview_path: previewPath,
      source_sha256: sha256,
      source_uploaded_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .select(
      "id, access_token, recovery_code, order_status, phone, amount, label, price_key, selected_styles, purchased_styles, mp_payment_id, mp_status, pix_code, qr_base64, created_at, paid_at, source_original_path, source_preview_path",
    )
    .single();

  if (updateError || !order) {
    throw new Error(updateError?.message ?? "Failed to persist uploaded photo");
  }

  await writeOrderEvent({
    eventType: "photo_uploaded",
    orderId,
    payload: {
      mimeType,
      originalPath,
      previewPath,
      sha256,
    },
    supabase,
  });

  return order as OrderRecord;
}

export async function ensurePaidOrderArtifacts(params: {
  order: Pick<OrderRecord, "id" | "order_status" | "phone" | "purchased_styles">;
  supabase: SupabaseClient;
}) {
  const { order, supabase } = params;
  const purchasedStyleIds = normalizeStyleIds(order.purchased_styles);
  if (purchasedStyleIds.length === 0) {
    return;
  }

  const now = new Date().toISOString();
  const resultRows = purchasedStyleIds.map((styleId) => ({
    order_id: order.id,
    result_bucket: ORDER_RESULTS_BUCKET,
    result_path: getOrderResultPath(order.id, styleId),
    status: "pending" satisfies OrderResultStatus,
    style_id: styleId,
  }));

  const { error: resultError } = await supabase
    .from("order_results")
    .upsert(resultRows, { onConflict: "order_id,style_id", ignoreDuplicates: false });

  if (resultError) {
    throw new Error(resultError.message);
  }

  if (order.phone) {
    const dedupeKey = `whatsapp:${order.id}:${order.phone}`;
    const { error: deliveryError } = await supabase.from("order_deliveries").upsert(
      {
        channel: "whatsapp",
        dedupe_key: dedupeKey,
        destination: order.phone,
        order_id: order.id,
        requested_at: now,
        status: "pending" satisfies OrderDeliveryStatus,
      },
      { onConflict: "dedupe_key", ignoreDuplicates: false },
    );

    if (deliveryError) {
      throw new Error(deliveryError.message);
    }
  }

  await writeOrderEvent({
    eventType: "paid_order_artifacts_ensured",
    orderId: order.id,
    payload: { purchasedStyleIds },
    supabase,
  });
}

async function createSignedUrlIfPresent(params: {
  bucket: string;
  path: null | string;
  supabase: SupabaseClient;
}) {
  const { bucket, path, supabase } = params;

  if (!path) {
    return null;
  }

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 12);
  if (error || !data?.signedUrl) {
    console.error("[signed-url]", error);
    return null;
  }

  return data.signedUrl;
}

export async function buildOrderAccessResponse(params: {
  order: OrderRecord;
  supabase: SupabaseClient;
}): Promise<OrderAccessResponse> {
  const { order, supabase } = params;

  const [{ data: resultRows, error: resultError }, { data: deliveryRows, error: deliveryError }] =
    await Promise.all([
      supabase
        .from("order_results")
        .select("style_id, status, result_path, preview_path, completed_at, last_error")
        .eq("order_id", order.id)
        .order("style_id", { ascending: true }),
      supabase
        .from("order_deliveries")
        .select("channel, status, destination, attempts, last_attempt_at, sent_at, last_error")
        .eq("order_id", order.id)
        .order("created_at", { ascending: true }),
    ]);

  if (resultError) {
    throw new Error(resultError.message);
  }

  if (deliveryError) {
    throw new Error(deliveryError.message);
  }

  const sourcePreviewUrl = await createSignedUrlIfPresent({
    bucket: ORDER_SOURCE_BUCKET,
    path: order.source_preview_path,
    supabase,
  });

  const results = await Promise.all(
    ((resultRows as OrderResultRow[] | null) ?? []).map(async (row) => {
      const [imageUrl, previewUrl] = await Promise.all([
        row.status === "completed"
          ? createSignedUrlIfPresent({
              bucket: ORDER_RESULTS_BUCKET,
              path: row.result_path,
              supabase,
            })
          : Promise.resolve(null),
        createSignedUrlIfPresent({
          bucket: ORDER_RESULTS_BUCKET,
          path: row.preview_path,
          supabase,
        }),
      ]);

      const summary: OrderResultSummary = {
        completedAt: row.completed_at,
        imageUrl,
        lastError: row.last_error,
        previewUrl,
        resultPath: row.result_path,
        status: row.status,
        styleId: row.style_id,
      };

      return summary;
    }),
  );

  const deliveries: OrderDeliverySummary[] = (
    (deliveryRows as OrderDeliveryRow[] | null) ?? []
  ).map((row) => ({
    attempts: row.attempts ?? 0,
    channel: row.channel,
    destination: row.destination,
    lastAttemptAt: row.last_attempt_at,
    lastError: row.last_error,
    sentAt: row.sent_at,
    status: row.status,
  }));

  return {
    order: {
      accessToken: order.access_token,
      amount: order.amount,
      createdAt: order.created_at,
      deliveries,
      id: order.id,
      label: order.label,
      mpStatus: order.mp_status,
      orderStatus: order.order_status,
      paidAt: order.paid_at,
      phoneNumber: order.phone,
      pixCode: order.pix_code,
      priceKey: order.price_key,
      purchasedStyleIds: normalizeStyleIds(order.purchased_styles),
      qrBase64: order.qr_base64,
      recoveryCode: order.recovery_code,
      results,
      selectedStyleIds: normalizeStyleIds(order.selected_styles),
      sourcePreviewUrl,
    },
  };
}
