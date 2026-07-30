import { MedusaError } from "@medusajs/framework/utils";

export type ShipStationOptions = {
  apiKey: string;
  baseUrl: string;
  uspsCarrierId?: string;
  rateLimitPerMinute: number;
  timeoutMs: number;
  maxRetries: number;
  weightUnit: string;
  dimensionUnit: string;
  cacheTtlSeconds: number;
  fromCountryCode: string;
  fromPostalCode: string;
};

const REQUIRED_OPTIONS = [
  "apiKey",
  "baseUrl",
  "rateLimitPerMinute",
  "timeoutMs",
  "maxRetries",
  "weightUnit",
  "dimensionUnit",
  "cacheTtlSeconds",
  "fromCountryCode",
  "fromPostalCode",
] as const;

export function validateShipStationOptions(
  options: Record<string, unknown>,
): void {
  const missing = REQUIRED_OPTIONS.filter(
    (key) => options[key] == null || options[key] === "",
  );

  if (missing.length > 0) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `ShipStation module requires the following options: ${missing.join(", ")}`,
    );
  }
}

export type PackableItem = {
  variantId: string;
  quantity: number;
  weight: number | null | undefined;
  length: number | null | undefined;
  width: number | null | undefined;
  height: number | null | undefined;
};

export type Parcel = {
  weight: number;
  length: number;
  width: number;
  height: number;
};

export type PackResult =
  { ok: true; parcel: Parcel } | { ok: false; missing: readonly string[] };

function isPositive(value: number | null | undefined): value is number {
  return typeof value === "number" && value > 0;
}

export function packItemsIntoOneBox(
  items: readonly PackableItem[],
): PackResult {
  if (items.length === 0) return { ok: false, missing: [] };

  const missing: string[] = [];
  let weight = 0;
  let length = 0;
  let width = 0;
  let height = 0;

  for (const item of items) {
    const itemWeight = item.weight;
    const itemLength = item.length;
    const itemWidth = item.width;
    const itemHeight = item.height;

    if (
      !isPositive(itemWeight) ||
      !isPositive(itemLength) ||
      !isPositive(itemWidth) ||
      !isPositive(itemHeight)
    ) {
      missing.push(item.variantId);
      continue;
    }

    weight += itemWeight * item.quantity;
    length = Math.max(length, itemLength);
    width = Math.max(width, itemWidth);
    height += itemHeight * item.quantity;
  }

  if (missing.length > 0) return { ok: false, missing };

  return { ok: true, parcel: { weight, length, width, height } };
}

export type EstimateRequestInput = {
  from: { countryCode: string; postalCode: string };
  to: {
    countryCode: string;
    postalCode: string;
    city: string;
    state: string;
    isResidential?: boolean;
  };
  parcel: Parcel;
  carrierId: string | undefined;
  weightUnit: string;
  dimensionUnit: string;
  shipDate: Date;
};

export function buildEstimateRequest(
  input: EstimateRequestInput,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    from_country_code: input.from.countryCode.toUpperCase(),
    from_postal_code: input.from.postalCode,
    to_country_code: input.to.countryCode.toUpperCase(),
    to_postal_code: input.to.postalCode,
    to_city_locality: input.to.city,
    to_state_province: input.to.state,
    weight: { value: input.parcel.weight, unit: input.weightUnit },
    dimensions: {
      unit: input.dimensionUnit,
      length: input.parcel.length,
      width: input.parcel.width,
      height: input.parcel.height,
    },
    confirmation: "none",
    address_residential_indicator:
      input.to.isResidential == null
        ? "unknown"
        : input.to.isResidential
          ? "yes"
          : "no",
    ship_date: input.shipDate.toISOString(),
  };

  if (input.carrierId) {
    body.carrier_ids = [input.carrierId];
  }

  return body;
}

export function extractRates(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;

  if (body != null && typeof body === "object") {
    const record = body as Record<string, unknown>;
    const nested = record.rate_response;

    if (nested != null && typeof nested === "object") {
      const nestedRates = (nested as Record<string, unknown>).rates;
      if (Array.isArray(nestedRates)) return nestedRates;
    }

    if (Array.isArray(record.rates)) return record.rates;
  }

  return [];
}

export type NormalizedRate = {
  rateId: string;
  carrierName: string;
  serviceName: string;
  serviceCode: string;
  amount: number;
  currencyCode: string;
  deliveryDays: number | null;
  estimatedDeliveryDate: string | null;
};

export function normalizeUspsRates(
  rawRates: readonly unknown[],
): NormalizedRate[] {
  const seenServiceCodes = new Set<string>();
  const rates: NormalizedRate[] = [];

  for (const raw of rawRates) {
    if (raw == null || typeof raw !== "object") continue;
    const rate = raw as Record<string, unknown>;

    const serviceCode =
      typeof rate.service_code === "string" ? rate.service_code : null;
    if (!serviceCode || !serviceCode.startsWith("usps_")) continue;
    if (seenServiceCodes.has(serviceCode)) continue;

    const shippingAmount = rate.shipping_amount as
      Record<string, unknown> | undefined;
    if (!shippingAmount || typeof shippingAmount.amount !== "number") continue;
    const amount = shippingAmount.amount;

    seenServiceCodes.add(serviceCode);
    rates.push({
      rateId: typeof rate.rate_id === "string" ? rate.rate_id : serviceCode,
      carrierName:
        typeof rate.carrier_friendly_name === "string"
          ? rate.carrier_friendly_name
          : "USPS",
      serviceName:
        typeof rate.service_type === "string" ? rate.service_type : serviceCode,
      serviceCode,
      amount,
      currencyCode:
        typeof shippingAmount.currency === "string"
          ? shippingAmount.currency
          : "usd",
      deliveryDays:
        typeof rate.delivery_days === "number" ? rate.delivery_days : null,
      estimatedDeliveryDate:
        typeof rate.estimated_delivery_date === "string"
          ? rate.estimated_delivery_date
          : null,
    });
  }

  return rates.sort((a, b) => a.amount - b.amount);
}

export type RateCacheKeyInput = {
  countryCode: string;
  postalCode: string;
  isResidential?: boolean;
  weightUnit: string;
  dimensionUnit: string;
  parcel: Parcel;
};

export function rateCacheKey(input: RateCacheKeyInput): string {
  const residential =
    input.isResidential == null ? "unk" : input.isResidential ? "res" : "com";

  return [
    "shipstation:rates:v1",
    input.countryCode.toLowerCase(),
    input.postalCode,
    residential,
    `${input.weightUnit}-${input.parcel.weight}`,
    `${input.parcel.length}x${input.parcel.width}x${input.parcel.height}${input.dimensionUnit}`,
  ].join(":");
}

export function parseRetryAfterMs(
  header: string | null,
  nowMs: number,
  maxMs: number,
): number | null {
  if (header == null || header.trim() === "") return null;

  const seconds = Number(header);
  if (Number.isFinite(seconds)) {
    return Math.max(0, Math.min(seconds * 1000, maxMs));
  }

  const dateMs = Date.parse(header);
  if (Number.isNaN(dateMs)) return null;

  return Math.max(0, Math.min(dateMs - nowMs, maxMs));
}

export type BucketState = {
  tokens: number;
  lastRefillMs: number;
  blockedUntilMs: number;
};

export function refillBucket(
  state: BucketState,
  nowMs: number,
  ratePerMinute: number,
  capacity: number,
): BucketState {
  if (nowMs <= state.lastRefillMs) return state;

  const elapsedMs = nowMs - state.lastRefillMs;
  const refill = (elapsedMs / 60_000) * ratePerMinute;
  if (refill <= 0) return state;

  return {
    ...state,
    tokens: Math.min(capacity, state.tokens + refill),
    lastRefillMs: nowMs,
  };
}

export function takeToken(
  state: BucketState,
  nowMs: number,
  ratePerMinute: number,
  capacity: number,
): { state: BucketState; waitMs: number } {
  const refilled = refillBucket(state, nowMs, ratePerMinute, capacity);

  if (nowMs < refilled.blockedUntilMs) {
    return { state: refilled, waitMs: refilled.blockedUntilMs - nowMs };
  }

  if (refilled.tokens >= 1) {
    return { state: { ...refilled, tokens: refilled.tokens - 1 }, waitMs: 0 };
  }

  const tokensNeeded = 1 - refilled.tokens;
  const msPerToken = 60_000 / ratePerMinute;
  return { state: refilled, waitMs: Math.ceil(tokensNeeded * msPerToken) };
}

export function applyRetryAfter(
  state: BucketState,
  nowMs: number,
  retryAfterMs: number,
): BucketState {
  return {
    ...state,
    tokens: 0,
    lastRefillMs: nowMs,
    blockedUntilMs: nowMs + retryAfterMs,
  };
}

export type ShipStationRateErrorReason =
  "timeout" | "http_error" | "empty" | "rate_limit_exhausted" | "misconfigured";

export class ShipStationRateError extends Error {
  reason: ShipStationRateErrorReason;

  constructor(reason: ShipStationRateErrorReason, message?: string) {
    super(message ?? reason);
    this.name = "ShipStationRateError";
    this.reason = reason;
  }
}

export const SHIPSTATION_RATE_LIMIT_LOG_TAG = "[shipstation:rate-limit]";
export const SHIPSTATION_UNAVAILABLE_LOG_TAG = "[shipstation:unavailable]";
