import type {
  OrderDeliveryStatus,
  OrderResultStatus,
  OrderStatus,
} from "./order-status.js";

export const ORDER_SOURCE_BUCKET = "fotojesus-order-source";
export const ORDER_RESULTS_BUCKET = "fotojesus-order-results";

export type StoredOrderSession = {
  accessToken: string;
  orderId: string;
  recoveryCode: null | string;
};

export type OrderResultSummary = {
  completedAt: null | string;
  imageUrl: null | string;
  lastError: null | string;
  previewUrl: null | string;
  resultPath: null | string;
  status: OrderResultStatus;
  styleId: number;
};

export type OrderDeliverySummary = {
  attempts: number;
  channel: string;
  destination: null | string;
  lastAttemptAt: null | string;
  lastError: null | string;
  sentAt: null | string;
  status: OrderDeliveryStatus;
};

export type OrderSummary = {
  accessToken: string;
  amount: null | number;
  createdAt: string;
  id: string;
  label: null | string;
  mpStatus: string;
  orderStatus: OrderStatus;
  paidAt: null | string;
  phoneNumber: null | string;
  email: null | string;
  pixCode: null | string;
  priceKey: null | string;
  purchasedStyleIds: number[];
  qrBase64: null | string;
  recoveryCode: null | string;
  results: OrderResultSummary[];
  selectedStyleIds: number[];
  source: null | string;
  sourcePreviewUrl: null | string;
  deliveries: OrderDeliverySummary[];
};

export type OrderAccessResponse = {
  order: OrderSummary;
};
