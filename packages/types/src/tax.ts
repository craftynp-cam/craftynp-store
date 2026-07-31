import { z } from "zod";

import {
  shippingRateDestinationSchema,
  shippingRateItemSchema,
} from "./shipping-rates.js";

export const taxQuoteRequestSchema = z.object({
  destination: shippingRateDestinationSchema,
  items: z.array(shippingRateItemSchema).min(1).max(50),
  shippingQuoteToken: z.string().min(1),
});
export type TaxQuoteRequest = z.infer<typeof taxQuoteRequestSchema>;

export const taxQuoteResponseSchema = z.object({
  taxAmount: z.number().nonnegative(),
  currencyCode: z.string().min(1),
  quoteToken: z.string().min(1),
});
export type TaxQuoteResponse = z.infer<typeof taxQuoteResponseSchema>;
