import type { NormalizedRate } from "../shipstation/lib";

export const SHIPPING_QUOTE_MISMATCH_LOG_TAG = "[shipping-quote:mismatch]";

export type ShippingMethodData = {
  rateId: string;
  serviceCode: string;
  quoteToken: string;
  amount: number;
};

function isShippingMethodData(value: unknown): value is ShippingMethodData {
  if (value == null || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.rateId === "string" &&
    typeof record.serviceCode === "string" &&
    typeof record.quoteToken === "string" &&
    typeof record.amount === "number"
  );
}

export function parseShippingMethodData(
  value: unknown,
): ShippingMethodData | null {
  return isShippingMethodData(value) ? value : null;
}

export function withinShippingTolerance(
  quotedAmount: number,
  freshAmount: number,
): boolean {
  const tolerance = Math.max(0.5, quotedAmount * 0.05);
  return Math.abs(freshAmount - quotedAmount) <= tolerance;
}

export function findRateByServiceCode(
  rates: readonly NormalizedRate[],
  serviceCode: string,
): NormalizedRate | undefined {
  return rates.find((rate) => rate.serviceCode === serviceCode);
}
