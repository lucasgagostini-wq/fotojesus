export const ORDER_STATUSES = [
  "draft",
  "photo_uploaded",
  "payment_pending",
  "payment_approved",
  "processing",
  "partially_completed",
  "completed",
  "delivery_pending",
  "delivery_retry_requested",
  "delivery_sent",
  "processing_failed",
  "delivery_failed",
  "cancelled",
] as const;

export const ORDER_RESULT_STATUSES = [
  "pending",
  "processing",
  "completed",
  "failed",
  "cancelled",
] as const;

export const ORDER_DELIVERY_STATUSES = [
  "pending",
  "queued",
  "retry_requested",
  "sent",
  "failed",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type OrderResultStatus = (typeof ORDER_RESULT_STATUSES)[number];
export type OrderDeliveryStatus = (typeof ORDER_DELIVERY_STATUSES)[number];

export function isPaidOrderStatus(status: OrderStatus): boolean {
  return [
    "payment_approved",
    "processing",
    "partially_completed",
    "completed",
    "delivery_pending",
    "delivery_retry_requested",
    "delivery_sent",
    "processing_failed",
    "delivery_failed",
  ].includes(status);
}
