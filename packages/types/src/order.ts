import { z } from "zod";

import {
  checkoutLineItemDetailSchema,
  checkoutTotalsSchema,
} from "./checkout.js";
import { orderStatusSchema, orderTrackingSchema } from "./order-status.js";

export const orderAddressSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string().nullable(),
  address1: z.string(),
  address2: z.string(),
  city: z.string(),
  state: z.string(),
  postalCode: z.string(),
  countryCode: z.string(),
});
export type OrderAddress = z.infer<typeof orderAddressSchema>;

export const orderConfirmationLineSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  variantTitle: z.string().nullable(),
  thumbnail: z.string().nullable(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  lineTotal: z.number().nonnegative(),
  isCustomizable: z.boolean(),
  details: z.array(checkoutLineItemDetailSchema),
});
export type OrderConfirmationLine = z.infer<typeof orderConfirmationLineSchema>;

export const orderConfirmationSchema = z.object({
  orderId: z.string().min(1),
  displayId: z.number().int().nonnegative(),
  email: z.string(),
  placedAt: z.string(),
  status: z.string(),
  fulfilmentStatus: orderStatusSchema,
  tracking: orderTrackingSchema.nullable(),
  shippingMethodName: z.string().nullable(),
  lines: z.array(orderConfirmationLineSchema),
  totals: checkoutTotalsSchema,
  shippingAddress: orderAddressSchema.nullable(),
  isGuest: z.boolean(),
});
export type OrderConfirmation = z.infer<typeof orderConfirmationSchema>;

export const orderConfirmationResponseSchema = z.object({
  order: orderConfirmationSchema,
});
export type OrderConfirmationResponse = z.infer<
  typeof orderConfirmationResponseSchema
>;
