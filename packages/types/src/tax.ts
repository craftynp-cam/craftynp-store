import { z } from "zod";

import { customDimensionsSchema } from "./customization.js";
import {
  shippingRateDestinationSchema,
  shippingRateItemSchema,
} from "./shipping-rates.js";

// Dimensions ride along so tax is calculated on what the line actually costs.
// An area-priced line's taxable amount is the area price, not the variant's
// own, and taxSignature still canonicalises variantId and quantity alone.
export const taxQuoteItemSchema = shippingRateItemSchema.extend({
  dimensions: customDimensionsSchema.optional(),
});
export type TaxQuoteItem = z.infer<typeof taxQuoteItemSchema>;

export const taxQuoteRequestSchema = z.object({
  destination: shippingRateDestinationSchema,
  items: z.array(taxQuoteItemSchema).min(1).max(50),
  shippingQuoteToken: z.string().min(1),
});
export type TaxQuoteRequest = z.infer<typeof taxQuoteRequestSchema>;

export const taxQuoteResponseSchema = z.object({
  taxAmount: z.number().nonnegative(),
  currencyCode: z.string().min(1),
  quoteToken: z.string().min(1),
});
export type TaxQuoteResponse = z.infer<typeof taxQuoteResponseSchema>;
