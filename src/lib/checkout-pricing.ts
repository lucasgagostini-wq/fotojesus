export const ALL_STYLE_IDS = [1, 2, 3, 4] as const;
export const BASE_STYLE_PRICE = 10.9;

export type CheckoutPriceKey =
  | "single"
  | "double"
  | "triple"
  | "quad"
  | "upsell_1_to_4"
  | "upsell_2_to_4"
  | "upsell_3_to_4";

type PriceConfig = {
  amount: number;
  label: string;
  requiredSelectedCount: number;
  deliverAllStyles: boolean;
};

const PRICE_CONFIG: Record<CheckoutPriceKey, PriceConfig> = {
  single: { amount: 10.9, label: "1 imagem", requiredSelectedCount: 1, deliverAllStyles: false },
  double: { amount: 21.8, label: "2 imagens", requiredSelectedCount: 2, deliverAllStyles: false },
  triple: { amount: 32.7, label: "3 imagens", requiredSelectedCount: 3, deliverAllStyles: false },
  quad: { amount: 43.6, label: "4 imagens", requiredSelectedCount: 4, deliverAllStyles: false },
  upsell_1_to_4: { amount: 22.6, label: "4 imagens", requiredSelectedCount: 1, deliverAllStyles: true },
  upsell_2_to_4: { amount: 29.6, label: "4 imagens", requiredSelectedCount: 2, deliverAllStyles: true },
  upsell_3_to_4: { amount: 36.6, label: "4 imagens", requiredSelectedCount: 3, deliverAllStyles: true },
};

export type CheckoutQuote = {
  amount: number;
  label: string;
  priceKey: CheckoutPriceKey;
  purchasedStyleIds: number[];
  selectedStyleIds: number[];
};

export function normalizeStyleIds(styleIds: readonly number[]): number[] {
  const validIds = new Set<number>();

  for (const styleId of styleIds) {
    if (ALL_STYLE_IDS.includes(styleId as (typeof ALL_STYLE_IDS)[number])) {
      validIds.add(styleId);
    }
  }

  return [...validIds].sort((left, right) => left - right);
}

export function getBaseTotalForCount(count: number): number {
  return Number((count * BASE_STYLE_PRICE).toFixed(2));
}

export function getCheckoutQuote(
  priceKey: CheckoutPriceKey,
  selectedStyleIds: readonly number[],
): CheckoutQuote {
  const config = PRICE_CONFIG[priceKey];
  const normalizedSelectedStyleIds = normalizeStyleIds(selectedStyleIds);

  if (!config) {
    throw new Error("Invalid checkout price key");
  }

  if (normalizedSelectedStyleIds.length !== config.requiredSelectedCount) {
    throw new Error("Selected styles do not match the checkout option");
  }

  return {
    amount: config.amount,
    label: config.label,
    priceKey,
    purchasedStyleIds: config.deliverAllStyles
      ? [...ALL_STYLE_IDS]
      : normalizedSelectedStyleIds,
    selectedStyleIds: normalizedSelectedStyleIds,
  };
}

export function getUpsellPriceKey(selectedCount: number): CheckoutPriceKey {
  if (selectedCount === 1) return "upsell_1_to_4";
  if (selectedCount === 2) return "upsell_2_to_4";
  if (selectedCount === 3) return "upsell_3_to_4";
  throw new Error("Upsell is only valid for 1 to 3 selected styles");
}
