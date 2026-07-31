import { z } from "zod";

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
  label: z.string().min(1),
  value: z.string().min(1),
});
export type CheckoutLineItemDetail = z.infer<
  typeof checkoutLineItemDetailSchema
>;

export const checkoutLineItemSchema = shippingRateItemSchema.extend({
  isCustomizable: z.boolean().optional(),
  details: z.array(checkoutLineItemDetailSchema).optional(),
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
  orderToken: z.string().min(1),
});
export type CheckoutCompleteResponse = z.infer<
  typeof checkoutCompleteResponseSchema
>;
