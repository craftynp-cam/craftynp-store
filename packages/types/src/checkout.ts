import { z } from "zod";

import { lineItemCustomizationSchema } from "./customization.js";
import {
  CUSTOMIZATION_INPUTS,
  type CustomizationInputKey,
} from "./product-customization.js";
import { shippingRateItemSchema } from "./shipping-rates.js";

export const checkoutAddressSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().min(1),
  address1: z.string().min(1),
  address2: z.string(),
  city: z.string().min(1),
  state: z.string().min(1),
  postalCode: z.string().min(1).max(16),
  countryCode: z.string().length(2),
});
export type CheckoutAddress = z.infer<typeof checkoutAddressSchema>;

export const checkoutLineItemDetailSchema = z.object({
  label: z.string().min(1).max(64),
  value: z.string().min(1).max(1000),
});
export type CheckoutLineItemDetail = z.infer<
  typeof checkoutLineItemDetailSchema
>;

export const checkoutLineItemSchema = shippingRateItemSchema.extend({
  details: z.array(checkoutLineItemDetailSchema).max(8).optional(),
  // Carried so prepare-cart can re-derive an area price from the size in the
  // line's customization rather than trusting one. It never reaches
  // cartSignature or taxSignature, which canonicalise variantId and quantity
  // alone.
  priceQuoteToken: z.string().min(1).optional(),
  customization: lineItemCustomizationSchema.optional(),
});
export type CheckoutLineItem = z.infer<typeof checkoutLineItemSchema>;

export const checkoutPrepareRequestSchema = z.object({
  cartId: z.string().min(1).optional(),
  email: z.string().email(),
  shippingAddress: checkoutAddressSchema,
  billingAddress: checkoutAddressSchema,
  items: z.array(checkoutLineItemSchema).min(1).max(50),
  shippingRateId: z.string().min(1),
  shippingServiceCode: z.string().min(1),
  shippingQuoteToken: z.string().min(1),
  taxQuoteToken: z.string().min(1),
});
export type CheckoutPrepareRequest = z.infer<
  typeof checkoutPrepareRequestSchema
>;

export const checkoutTotalsSchema = z.object({
  subtotal: z.number().nonnegative(),
  shipping: z.number().nonnegative(),
  tax: z.number().nonnegative(),
  total: z.number().nonnegative(),
  currencyCode: z.string().min(1),
});
export type CheckoutTotals = z.infer<typeof checkoutTotalsSchema>;

export const checkoutPrepareResponseSchema = z.object({
  cartId: z.string().min(1),
  clientSecret: z.string().min(1),
  totals: checkoutTotalsSchema,
});
export type CheckoutPrepareResponse = z.infer<
  typeof checkoutPrepareResponseSchema
>;

export const checkoutCompleteRequestSchema = z.object({
  cartId: z.string().min(1),
});
export type CheckoutCompleteRequest = z.infer<
  typeof checkoutCompleteRequestSchema
>;

export const checkoutCompleteResponseSchema = z.object({
  orderId: z.string().min(1),
  displayId: z.number().int().nonnegative(),
  orderToken: z.string().min(1).optional(),
});
export type CheckoutCompleteResponse = z.infer<
  typeof checkoutCompleteResponseSchema
>;

export const CHECKOUT_LINE_REFUSAL_REASONS = {
  invalid_customization: [
    "unknown_variant",
    "artwork_not_found",
    "artwork_not_inspected",
    "missing_required",
    "input_off",
    "rejected",
  ],
  invalid_price_quote: [
    "missing",
    "malformed",
    "bad_signature",
    "expired",
    "line_mismatch",
    "unknown_variant",
    "unpriced",
    "unconfigured",
    "bad_dimensions",
  ],
} as const;

type LineRefusalReasons = typeof CHECKOUT_LINE_REFUSAL_REASONS;

export type CheckoutLineRefusalError = keyof LineRefusalReasons;
export type CheckoutLineRefusalReason<
  E extends CheckoutLineRefusalError = CheckoutLineRefusalError,
> = LineRefusalReasons[E][number];

export type CheckoutLineRefusal = {
  [E in CheckoutLineRefusalError]: {
    error: E;
    reason: CheckoutLineRefusalReason<E>;
    input?: CustomizationInputKey;
    line: number;
  };
}[CheckoutLineRefusalError];

const INPUT_REASONS: readonly string[] = ["missing_required", "input_off"];

const LINE_REFUSAL_HEAD =
  /^([a-z_]+(?::[a-z_]+){1,2}@\d+(?:,[a-z_]+(?::[a-z_]+){1,2}@\d+)*)(?:\s|$)/;

export function isCheckoutLineRefusal(
  value: unknown,
): value is CheckoutLineRefusal {
  if (typeof value !== "object" || value === null) return false;
  const { error, reason, input, line } = value as Record<string, unknown>;

  if (
    typeof error !== "string" ||
    !Object.hasOwn(CHECKOUT_LINE_REFUSAL_REASONS, error)
  ) {
    return false;
  }
  const reasons: readonly string[] =
    CHECKOUT_LINE_REFUSAL_REASONS[error as CheckoutLineRefusalError];
  if (typeof reason !== "string" || !reasons.includes(reason)) return false;
  if (typeof line !== "number" || !Number.isSafeInteger(line) || line < 0) {
    return false;
  }

  const takesInput =
    error === "invalid_customization" && INPUT_REASONS.includes(reason);
  if (!takesInput) return input === undefined;

  return CUSTOMIZATION_INPUTS.some((candidate) => candidate.key === input);
}

export function formatCheckoutLineRefusals(
  refusals: readonly (CheckoutLineRefusal & { detail?: string })[],
): string {
  const head = refusals
    .map(
      ({ error, reason, input, line }) =>
        `${error}:${reason}${input ? `:${input}` : ""}@${line}`,
    )
    .join(",");
  const details = refusals.flatMap(({ line, detail }) =>
    detail ? [`line ${line}: ${detail}`] : [],
  );

  return details.length > 0 ? `${head} ${details.join("; ")}` : head;
}

export function parseCheckoutLineRefusals(
  message: string,
): CheckoutLineRefusal[] | null {
  const head = LINE_REFUSAL_HEAD.exec(message)?.[1];
  if (head === undefined) return null;

  const refusals: CheckoutLineRefusal[] = [];

  for (const entry of head.split(",")) {
    const [code = "", line = ""] = entry.split("@");
    const [error, reason, input] = code.split(":");
    const candidate = {
      error,
      reason,
      ...(input === undefined ? {} : { input }),
      line: Number(line),
    };

    if (!isCheckoutLineRefusal(candidate)) return null;
    refusals.push(candidate);
  }

  return refusals;
}
