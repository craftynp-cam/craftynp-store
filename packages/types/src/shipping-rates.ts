import { z } from "zod";

export const shippingRateDestinationSchema = z.object({
  countryCode: z.string().length(2),
  postalCode: z.string().min(1).max(16),
  city: z.string().min(1),
  state: z.string().min(1),
  isResidential: z.boolean().optional(),
});
export type ShippingRateDestination = z.infer<
  typeof shippingRateDestinationSchema
>;

export const shippingRateItemSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().int().min(1).max(999),
});
export type ShippingRateItem = z.infer<typeof shippingRateItemSchema>;

export const shippingRateRequestSchema = z.object({
  destination: shippingRateDestinationSchema,
  items: z.array(shippingRateItemSchema).min(1).max(50),
});
export type ShippingRateRequest = z.infer<typeof shippingRateRequestSchema>;

export const shippingRateSchema = z.object({
  rateId: z.string().min(1),
  carrierName: z.string().min(1),
  serviceName: z.string().min(1),
  serviceCode: z.string().min(1),
  amount: z.number().nonnegative(),
  currencyCode: z.string().min(1),
  deliveryDays: z.number().int().nonnegative().nullable(),
  estimatedDeliveryDate: z.string().nullable(),
  quoteToken: z.string().min(1),
});
export type ShippingRate = z.infer<typeof shippingRateSchema>;

export const shippingRatesResponseSchema = z.object({
  rates: z.array(shippingRateSchema).min(1),
});
export type ShippingRatesResponse = z.infer<typeof shippingRatesResponseSchema>;
