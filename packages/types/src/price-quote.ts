import { z } from "zod";

import { customDimensionsSchema } from "./customization.js";

// The request names no price: what a line costs is resolved from Medusa and the
// product's own metadata, server-side. Dimensions are sent so the server can
// price an area, and are re-checked against the product's bounds before it does.
export const priceQuoteRequestSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().int().min(1).max(999),
  dimensions: customDimensionsSchema.optional(),
});
export type PriceQuoteRequest = z.infer<typeof priceQuoteRequestSchema>;

export const priceQuoteResponseSchema = z.object({
  unitAmount: z.number().nonnegative(),
  lineTotal: z.number().nonnegative(),
  originalUnitAmount: z.number().nonnegative().nullable(),
  currencyCode: z.string().min(1),
  isAreaPriced: z.boolean(),
  quoteToken: z.string().min(1),
});
export type PriceQuoteResponse = z.infer<typeof priceQuoteResponseSchema>;
