import { MedusaError } from "@medusajs/framework/utils";
import type { LabelFailureReason, LiveRate } from "@craftynp/types";

export type ShipStationOptions = {
  apiKey: string;
  baseUrl: string;
  uspsCarrierId?: string;
  rateLimitPerMinute: number;
  timeoutMs: number;
  labelTimeoutMs: number;
  maxRetries: number;
  weightUnit: string;
  dimensionUnit: string;
  cacheTtlSeconds: number;
  testLabels: boolean;
  fromName: string;
  fromPhone: string;
  fromCompany?: string;
  fromAddress1: string;
  fromAddress2?: string;
  fromCity: string;
  fromState: string;
  fromCountryCode: string;
  fromPostalCode: string;
};

const REQUIRED_OPTIONS = [
  "apiKey",
  "baseUrl",
  "rateLimitPerMinute",
  "timeoutMs",
  "labelTimeoutMs",
  "maxRetries",
  "weightUnit",
  "dimensionUnit",
  "cacheTtlSeconds",
  "fromName",
  "fromPhone",
  "fromAddress1",
  "fromCity",
  "fromState",
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
export const SHIPSTATION_LABEL_LOG_TAG = "[shipstation:label]";
export const SHIPSTATION_VOID_LOG_TAG = "[shipstation:void]";
export const SHIPSTATION_BALANCE_LOG_TAG = "[shipstation:balance]";

export class ShipStationLabelError extends Error {
  reason: LabelFailureReason;
  carrierMessage: string | null;

  constructor(
    reason: LabelFailureReason,
    message?: string,
    carrierMessage?: string | null,
  ) {
    super(message ?? reason);
    this.name = "ShipStationLabelError";
    this.reason = reason;
    this.carrierMessage = carrierMessage ?? null;
  }
}

export type ShipStationAddress = {
  name: string;
  phone: string;
  companyName?: string;
  addressLine1: string;
  addressLine2?: string;
  cityLocality: string;
  stateProvince: string;
  postalCode: string;
  countryCode: string;
  isResidential?: boolean;
};

export function buildShipFromAddress(
  options: ShipStationOptions,
): ShipStationAddress {
  return {
    name: options.fromName,
    phone: options.fromPhone,
    companyName: options.fromCompany,
    addressLine1: options.fromAddress1,
    addressLine2: options.fromAddress2,
    cityLocality: options.fromCity,
    stateProvince: options.fromState,
    postalCode: options.fromPostalCode,
    countryCode: options.fromCountryCode,
    isResidential: false,
  };
}

export function buildAddressPayload(
  address: ShipStationAddress,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: address.name,
    address_line1: address.addressLine1,
    city_locality: address.cityLocality,
    state_province: address.stateProvince,
    postal_code: address.postalCode,
    country_code: address.countryCode.toUpperCase(),
    address_residential_indicator:
      address.isResidential == null
        ? "unknown"
        : address.isResidential
          ? "yes"
          : "no",
  };

  if (address.phone) payload.phone = address.phone;
  if (address.companyName) payload.company_name = address.companyName;
  if (address.addressLine2) payload.address_line2 = address.addressLine2;

  return payload;
}

export function buildPackagePayload(
  parcel: Parcel,
  weightUnit: string,
  dimensionUnit: string,
): Record<string, unknown> {
  return {
    weight: { value: parcel.weight, unit: weightUnit },
    dimensions: {
      unit: dimensionUnit,
      length: parcel.length,
      width: parcel.width,
      height: parcel.height,
    },
  };
}

export type RatesRequestInput = {
  shipFrom: ShipStationAddress;
  shipTo: ShipStationAddress;
  parcel: Parcel;
  carrierIds: readonly string[];
  weightUnit: string;
  dimensionUnit: string;
  shipDate: Date;
};

export function buildRatesRequest(
  input: RatesRequestInput,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    shipment: {
      ship_from: buildAddressPayload(input.shipFrom),
      ship_to: buildAddressPayload(input.shipTo),
      packages: [
        buildPackagePayload(
          input.parcel,
          input.weightUnit,
          input.dimensionUnit,
        ),
      ],
      confirmation: "none",
      ship_date: input.shipDate.toISOString(),
    },
  };

  body.rate_options = { carrier_ids: [...input.carrierIds] };

  return body;
}

export type LabelRequestInput = {
  shipFrom: ShipStationAddress;
  shipTo: ShipStationAddress;
  parcel: Parcel;
  carrierId: string;
  serviceCode: string;
  externalShipmentId: string;
  weightUnit: string;
  dimensionUnit: string;
  shipDate: Date;
  testLabel: boolean;
};

export function buildLabelRequest(
  input: LabelRequestInput,
): Record<string, unknown> {
  return {
    shipment: {
      carrier_id: input.carrierId,
      service_code: input.serviceCode,
      external_shipment_id: input.externalShipmentId,
      ship_from: buildAddressPayload(input.shipFrom),
      ship_to: buildAddressPayload(input.shipTo),
      packages: [
        buildPackagePayload(
          input.parcel,
          input.weightUnit,
          input.dimensionUnit,
        ),
      ],
      confirmation: "none",
      ship_date: input.shipDate.toISOString(),
    },
    label_format: "pdf",
    label_layout: "4x6",
    label_download_type: "url",
    test_label: input.testLabel,
  };
}

function moneyAmount(value: unknown): number {
  if (value == null || typeof value !== "object") return 0;
  const amount = (value as Record<string, unknown>).amount;
  return typeof amount === "number" && Number.isFinite(amount) ? amount : 0;
}

function moneyCurrency(value: unknown, fallback: string): string {
  if (value == null || typeof value !== "object") return fallback;
  const currency = (value as Record<string, unknown>).currency;
  return typeof currency === "string" && currency !== "" ? currency : fallback;
}

export function normalizeLiveRates(
  rawRates: readonly unknown[],
  opts: { carrierId?: string } = {},
): LiveRate[] {
  const rates: LiveRate[] = [];

  for (const raw of rawRates) {
    if (raw == null || typeof raw !== "object") continue;
    const rate = raw as Record<string, unknown>;

    const serviceCode =
      typeof rate.service_code === "string" ? rate.service_code : null;
    if (!serviceCode) continue;

    const carrierId =
      typeof rate.carrier_id === "string" ? rate.carrier_id : "";
    if (opts.carrierId && carrierId !== opts.carrierId) continue;

    const shipping = rate.shipping_amount;
    if (shipping == null || typeof shipping !== "object") continue;
    if (typeof (shipping as Record<string, unknown>).amount !== "number") {
      continue;
    }

    const shippingAmount = moneyAmount(shipping);
    const surcharges =
      moneyAmount(rate.insurance_amount) +
      moneyAmount(rate.confirmation_amount) +
      moneyAmount(rate.other_amount);

    rates.push({
      rateId: typeof rate.rate_id === "string" ? rate.rate_id : serviceCode,
      carrierId,
      carrierCode:
        typeof rate.carrier_code === "string" ? rate.carrier_code : "",
      carrierName:
        typeof rate.carrier_friendly_name === "string"
          ? rate.carrier_friendly_name
          : (rate.carrier_code as string) || "Carrier",
      serviceName:
        typeof rate.service_type === "string" ? rate.service_type : serviceCode,
      serviceCode,
      amount: Number((shippingAmount + surcharges).toFixed(2)),
      shippingAmount,
      surcharges: Number(surcharges.toFixed(2)),
      currencyCode: moneyCurrency(shipping, "usd"),
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

export type PurchasedLabel = {
  labelId: string;
  trackingNumber: string;
  carrierCode: string;
  carrierId: string;
  serviceCode: string;
  shipmentCost: number;
  currencyCode: string;
  insuranceCost: number;
  pdfUrl: string | null;
  status: string;
  shipToName: string | null;
  shipToPostalCode: string | null;
  createdAt: string | null;
};

function readShipTo(record: Record<string, unknown>): Record<string, unknown> {
  const direct = record.ship_to;
  if (direct != null && typeof direct === "object") {
    return direct as Record<string, unknown>;
  }

  const shipment = record.shipment;
  if (shipment != null && typeof shipment === "object") {
    const nested = (shipment as Record<string, unknown>).ship_to;
    if (nested != null && typeof nested === "object") {
      return nested as Record<string, unknown>;
    }
  }

  return {};
}

export function extractLabel(body: unknown): PurchasedLabel | null {
  if (body == null || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;

  const labelId = typeof record.label_id === "string" ? record.label_id : null;
  const trackingNumber =
    typeof record.tracking_number === "string" ? record.tracking_number : null;
  if (!labelId || !trackingNumber) return null;

  const download = record.label_download;
  const pdfUrl =
    download != null && typeof download === "object"
      ? typeof (download as Record<string, unknown>).pdf === "string"
        ? ((download as Record<string, unknown>).pdf as string)
        : typeof (download as Record<string, unknown>).href === "string"
          ? ((download as Record<string, unknown>).href as string)
          : null
      : null;

  const shipTo = readShipTo(record);

  return {
    labelId,
    trackingNumber,
    carrierCode:
      typeof record.carrier_code === "string" ? record.carrier_code : "",
    carrierId: typeof record.carrier_id === "string" ? record.carrier_id : "",
    serviceCode:
      typeof record.service_code === "string" ? record.service_code : "",
    shipmentCost: moneyAmount(record.shipment_cost),
    currencyCode: moneyCurrency(record.shipment_cost, "usd"),
    insuranceCost: moneyAmount(record.insurance_cost),
    pdfUrl,
    status: typeof record.status === "string" ? record.status : "unknown",
    shipToName: typeof shipTo.name === "string" ? shipTo.name : null,
    shipToPostalCode:
      typeof shipTo.postal_code === "string" ? shipTo.postal_code : null,
    createdAt: typeof record.created_at === "string" ? record.created_at : null,
  };
}

export function extractVoidResult(body: unknown): {
  approved: boolean;
  message: string;
} {
  if (body == null || typeof body !== "object") {
    return { approved: false, message: "The carrier gave no response." };
  }

  const record = body as Record<string, unknown>;
  return {
    approved: record.approved === true,
    message:
      typeof record.message === "string" && record.message !== ""
        ? record.message
        : "The carrier gave no reason.",
  };
}

export type CarrierSummary = {
  carrierId: string;
  carrierName: string;
  balance: number | null;
  currencyCode: string;
};

export function extractCarriers(body: unknown): CarrierSummary[] {
  if (body == null || typeof body !== "object") return [];

  const carriers = (body as Record<string, unknown>).carriers;
  if (!Array.isArray(carriers)) return [];

  const summaries: CarrierSummary[] = [];

  for (const raw of carriers) {
    if (raw == null || typeof raw !== "object") continue;
    const carrier = raw as Record<string, unknown>;

    if (typeof carrier.carrier_id !== "string") continue;
    if (carrier.disabled_by_billing_plan === true) continue;

    summaries.push({
      carrierId: carrier.carrier_id,
      carrierName:
        typeof carrier.friendly_name === "string"
          ? carrier.friendly_name
          : typeof carrier.nickname === "string"
            ? carrier.nickname
            : "Carrier",
      balance: typeof carrier.balance === "number" ? carrier.balance : null,
      currencyCode:
        typeof carrier.currency === "string" ? carrier.currency : "usd",
    });
  }

  return summaries;
}

export type ReconcileCriteria = {
  externalShipmentId: string;
  shipToName: string;
  shipToPostalCode: string;
  serviceCode: string;
  sinceMs: number;
};

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function matchReconciledLabel(
  labels: readonly unknown[],
  criteria: ReconcileCriteria,
): PurchasedLabel | null {
  for (const raw of labels) {
    if (raw == null || typeof raw !== "object") continue;
    const record = raw as Record<string, unknown>;

    const external =
      typeof record.external_shipment_id === "string"
        ? record.external_shipment_id
        : null;

    const label = extractLabel(record);
    if (!label) continue;

    if (label.serviceCode !== criteria.serviceCode) continue;

    if (label.createdAt) {
      const createdMs = Date.parse(label.createdAt);
      if (Number.isNaN(createdMs) || createdMs < criteria.sinceMs) continue;
    }

    if (external && external === criteria.externalShipmentId) return label;

    if (label.shipToPostalCode !== criteria.shipToPostalCode) continue;
    if (
      !label.shipToName ||
      normalizeName(label.shipToName) !== normalizeName(criteria.shipToName)
    ) {
      continue;
    }

    return label;
  }

  return null;
}
