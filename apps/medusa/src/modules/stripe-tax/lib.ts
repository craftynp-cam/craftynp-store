import { MedusaError } from "@medusajs/framework/utils";
import Stripe from "stripe";

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
  "timeout" | "http_error" | "invalid_address" | "misconfigured";

export class StripeTaxError extends Error {
  reason: StripeTaxErrorReason;

  constructor(reason: StripeTaxErrorReason, message?: string) {
    super(message ?? reason);
    this.name = "StripeTaxError";
    this.reason = reason;
  }
}

export const STRIPE_TAX_UNAVAILABLE_LOG_TAG = "[stripe-tax:unavailable]";

export function toStripeTaxError(error: unknown): StripeTaxError {
  if (error instanceof Stripe.errors.StripeConnectionError) {
    return new StripeTaxError("timeout", error.message);
  }

  if (
    error instanceof Stripe.errors.StripeInvalidRequestError &&
    typeof error.param === "string" &&
    error.param.includes("address")
  ) {
    return new StripeTaxError("invalid_address", error.message);
  }

  if (error instanceof Stripe.errors.StripeError) {
    return new StripeTaxError("http_error", error.message);
  }

  return new StripeTaxError(
    "http_error",
    error instanceof Error ? error.message : String(error),
  );
}

/**
 * Converts a Stripe-calculated tax amount into the percentage rate Medusa's
 * `ITaxProvider.getTaxLines` contract expects. `getTaxLines` returns rates,
 * not amounts, so Stripe's per-line tax amount is converted to a percentage
 * of that line's base amount — both in the same (minor) unit, so the ratio is
 * unit-independent. This is a deliberate, accepted tradeoff: rounding a
 * calculation-time amount into a rate and then re-multiplying it against the
 * cart's own line amount can drift by up to a cent or two per line versus the
 * Stripe Tax calculation recorded as the transaction of record at order
 * placement (see the `order.placed` subscriber). The cart total is still the
 * authoritative charge either way.
 */
export function amountToRate(taxAmount: number, baseAmount: number): number {
  if (baseAmount <= 0) return 0;
  return Math.round((taxAmount / baseAmount) * 100 * 10_000) / 10_000;
}

export type ProviderTaxableItem = {
  id: string;
  unitPrice: number;
  quantity: number;
  currencyCode?: string;
};

export type ProviderTaxableShipping = {
  unitPrice: number;
  currencyCode?: string;
};

export type ProviderAddress = {
  countryCode: string;
  postalCode?: string | null;
  city?: string | null;
  provinceCode?: string | null;
};

export function buildProviderCalculationInput(
  itemLines: readonly ProviderTaxableItem[],
  shippingLines: readonly ProviderTaxableShipping[],
  address: ProviderAddress,
): CalculationParamsInput {
  const currencyCode =
    itemLines[0]?.currencyCode ?? shippingLines[0]?.currencyCode ?? "usd";

  const lineItems = itemLines.map((item) => ({
    reference: item.id,
    amount: item.unitPrice,
    quantity: item.quantity,
  }));

  const shippingAmount = shippingLines.reduce(
    (sum, line) => sum + line.unitPrice,
    0,
  );

  return {
    currencyCode,
    destination: {
      countryCode: address.countryCode,
      postalCode: address.postalCode ?? "",
      city: address.city ?? "",
      state: address.provinceCode ?? "",
    },
    lineItems,
    shippingAmount,
  };
}

export type ProviderLineRate = {
  reference: string;
  rate: number;
};

export type NormalizedProviderCalculation = {
  calculationId: string;
  currencyCode: string;
  itemRates: readonly ProviderLineRate[];
  shippingRate: number;
};

export function normalizeProviderCalculation(
  calculation: Stripe.Tax.Calculation,
): NormalizedProviderCalculation {
  const itemRates = (calculation.line_items?.data ?? []).map((line) => ({
    reference: line.reference,
    rate: amountToRate(line.amount_tax, line.amount),
  }));

  const shippingRate = calculation.shipping_cost
    ? amountToRate(
        calculation.shipping_cost.amount_tax,
        calculation.shipping_cost.amount,
      )
    : 0;

  return {
    calculationId: calculation.id ?? "",
    currencyCode: calculation.currency,
    itemRates,
    shippingRate,
  };
}
