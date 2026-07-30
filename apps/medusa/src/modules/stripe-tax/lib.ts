import { MedusaError } from "@medusajs/framework/utils";
import type Stripe from "stripe";

export type StripeTaxOptions = {
  secretKey: string;
  defaultTaxCode: string;
  shippingTaxCode: string;
  timeoutMs: number;
  maxRetries: number;
  cacheTtlSeconds: number;
};

const REQUIRED_OPTIONS = [
  "secretKey",
  "defaultTaxCode",
  "shippingTaxCode",
  "timeoutMs",
  "maxRetries",
  "cacheTtlSeconds",
] as const;

export function validateStripeTaxOptions(
  options: Record<string, unknown>,
): void {
  const missing = REQUIRED_OPTIONS.filter(
    (key) => options[key] == null || options[key] === "",
  );

  if (missing.length > 0) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Stripe Tax module requires the following options: ${missing.join(", ")}`,
    );
  }
}

export function toMinorUnits(amount: number): number {
  return Math.round(amount * 100);
}

export function fromMinorUnits(amount: number): number {
  return Math.round(amount) / 100;
}

export type TaxLineItem = {
  reference: string;
  amount: number;
  quantity: number;
};

export type TaxDestination = {
  countryCode: string;
  postalCode: string;
  city: string;
  state: string;
};

export type CalculationParamsInput = {
  currencyCode: string;
  destination: TaxDestination;
  lineItems: readonly TaxLineItem[];
  shippingAmount: number;
};

export function buildCalculationParams(
  input: CalculationParamsInput,
  options: StripeTaxOptions,
): Stripe.Tax.CalculationCreateParams {
  return {
    currency: input.currencyCode.toLowerCase(),
    line_items: input.lineItems.map((item) => ({
      reference: item.reference,
      amount: toMinorUnits(item.amount),
      quantity: item.quantity,
      tax_code: options.defaultTaxCode,
      tax_behavior: "exclusive",
    })),
    shipping_cost: {
      amount: toMinorUnits(input.shippingAmount),
      tax_code: options.shippingTaxCode,
      tax_behavior: "exclusive",
    },
    customer_details: {
      address: {
        line1: "",
        city: input.destination.city,
        state: input.destination.state,
        postal_code: input.destination.postalCode,
        country: input.destination.countryCode.toUpperCase(),
      },
      address_source: "shipping",
    },
  };
}

export type NormalizedCalculation = {
  calculationId: string;
  taxAmount: number;
  currencyCode: string;
};

export function normalizeCalculation(
  calculation: Stripe.Tax.Calculation,
): NormalizedCalculation {
  return {
    calculationId: calculation.id ?? "",
    taxAmount: fromMinorUnits(calculation.tax_amount_exclusive),
    currencyCode: calculation.currency,
  };
}

export type TaxCacheKeyInput = {
  countryCode: string;
  postalCode: string;
  state: string;
  city: string;
  currencyCode: string;
  shippingAmount: number;
  lineItems: readonly TaxLineItem[];
};

export function taxCacheKey(input: TaxCacheKeyInput): string {
  const items = [...input.lineItems]
    .map((item) => `${item.reference}:${item.quantity}:${item.amount}`)
    .sort()
    .join(",");

  return [
    "stripe-tax:calculations:v1",
    input.countryCode.toLowerCase(),
    input.postalCode,
    input.state.toLowerCase(),
    input.city.toLowerCase(),
    input.currencyCode.toLowerCase(),
    input.shippingAmount,
    items,
  ].join(":");
}

export type StripeTaxErrorReason =
  | "timeout"
  | "http_error"
  | "invalid_address"
  | "misconfigured";

export class StripeTaxError extends Error {
  reason: StripeTaxErrorReason;

  constructor(reason: StripeTaxErrorReason, message?: string) {
    super(message ?? reason);
    this.name = "StripeTaxError";
    this.reason = reason;
  }
}

export const STRIPE_TAX_UNAVAILABLE_LOG_TAG = "[stripe-tax:unavailable]";
