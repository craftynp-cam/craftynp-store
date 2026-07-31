import type { NormalizedRate } from "../shipstation/lib";

export const SHIPPING_QUOTE_MISMATCH_LOG_TAG = "[shipping-quote:mismatch]";

export type ShippingMethodData = {
  rateId: string;
  serviceCode: string;
  quoteToken: string;
  /** The price the shopper was shown when they selected this rate. Used only
   * to detect a bait-and-switch when the signed quote token can no longer be
   * trusted — the amount actually charged always comes from a verified token
   * or a fresh ShipStation estimate, never from this field. */
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

/**
 * A quoted amount is within tolerance of a freshly re-estimated amount if the
 * absolute difference is no more than the greater of $0.50 or 5% of the
 * quoted amount. ShipStation's rate estimate is not purchasable and cannot be
 * replayed by rate id at placement time, so a fresh estimate is compared
 * against the signed quote rather than trusted or re-fetched verbatim.
 */
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
