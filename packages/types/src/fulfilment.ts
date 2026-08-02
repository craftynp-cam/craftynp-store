import { z } from "zod";

export const MAX_PARCEL_WEIGHT_GRAMS = 68039;
export const MAX_PARCEL_DIMENSION_CM = 274;

export const parcelOverrideSchema = z.object({
  weight: z.number().positive().max(MAX_PARCEL_WEIGHT_GRAMS),
  length: z.number().positive().max(MAX_PARCEL_DIMENSION_CM),
  width: z.number().positive().max(MAX_PARCEL_DIMENSION_CM),
  height: z.number().positive().max(MAX_PARCEL_DIMENSION_CM),
});
export type ParcelOverride = z.infer<typeof parcelOverrideSchema>;

export const rateShipmentRequestSchema = z.object({
  parcel: parcelOverrideSchema.optional(),
});
export type RateShipmentRequest = z.infer<typeof rateShipmentRequestSchema>;

export const buyLabelRequestSchema = z.object({
  rateId: z.string().min(1).max(120),
  carrierId: z.string().min(1).max(60),
  serviceCode: z.string().min(1).max(60),
  parcel: parcelOverrideSchema,
});
export type BuyLabelRequest = z.infer<typeof buyLabelRequestSchema>;

export const printLabelsRequestSchema = z.object({
  orderIds: z.array(z.string().min(1)).min(1).max(50),
});
export type PrintLabelsRequest = z.infer<typeof printLabelsRequestSchema>;

export const liveRateSchema = z.object({
  rateId: z.string().min(1),
  carrierId: z.string().min(1),
  carrierCode: z.string().min(1),
  carrierName: z.string().min(1),
  serviceName: z.string().min(1),
  serviceCode: z.string().min(1),
  packageCode: z.string().nullable(),
  packageName: z.string().nullable(),
  amount: z.number().nonnegative(),
  shippingAmount: z.number().nonnegative(),
  surcharges: z.number().nonnegative(),
  currencyCode: z.string().min(1),
  deliveryDays: z.number().int().nonnegative().nullable(),
  estimatedDeliveryDate: z.string().nullable(),
});
export type LiveRate = z.infer<typeof liveRateSchema>;

export const rateShipmentResponseSchema = z.object({
  rates: z.array(liveRateSchema),
  parcel: parcelOverrideSchema,
  derivedParcel: parcelOverrideSchema.nullable(),
});
export type RateShipmentResponse = z.infer<typeof rateShipmentResponseSchema>;

export const queueItemSchema = z.object({
  title: z.string(),
  variantTitle: z.string().nullable(),
  sku: z.string().nullable(),
  quantity: z.number().int().positive(),
});
export type QueueItem = z.infer<typeof queueItemSchema>;

export const queueDestinationSchema = z.object({
  name: z.string(),
  phone: z.string().nullable(),
  addressLine1: z.string(),
  addressLine2: z.string().nullable(),
  city: z.string(),
  state: z.string(),
  postalCode: z.string(),
  countryCode: z.string(),
});
export type QueueDestination = z.infer<typeof queueDestinationSchema>;

export const queueEntrySchema = z.object({
  orderId: z.string(),
  displayId: z.number().int(),
  placedAt: z.string(),
  customerName: z.string(),
  destination: queueDestinationSchema.nullable(),
  items: z.array(queueItemSchema),
  derivedParcel: parcelOverrideSchema.nullable(),
  missingDimensions: z.array(z.string()),
});
export type QueueEntry = z.infer<typeof queueEntrySchema>;

export const printableLabelSchema = z.object({
  orderId: z.string(),
  displayId: z.number().int(),
  customerName: z.string(),
  trackingNumber: z.string(),
  carrierCode: z.string().nullable(),
  shippedAt: z.string().nullable(),
});
export type PrintableLabel = z.infer<typeof printableLabelSchema>;

export const fulfilmentQueueResponseSchema = z.object({
  orders: z.array(queueEntrySchema),
  printable: z.array(printableLabelSchema),
});
export type FulfilmentQueueResponse = z.infer<
  typeof fulfilmentQueueResponseSchema
>;

export const carrierBalanceSchema = z.object({
  carrierName: z.string(),
  balance: z.number(),
  currencyCode: z.string(),
});
export type CarrierBalance = z.infer<typeof carrierBalanceSchema>;

export const balanceResponseSchema = z.object({
  balances: z.array(carrierBalanceSchema),
  fetchedAt: z.string().nullable(),
  available: z.boolean(),
});
export type BalanceResponse = z.infer<typeof balanceResponseSchema>;

export const shipmentLabelSchema = z.object({
  labelId: z.string().nullable(),
  serviceCode: z.string().nullable(),
  shipmentCost: z.number().nullable(),
  currencyCode: z.string().nullable(),
  labelUrl: z.string().nullable(),
  canPrint: z.boolean(),
});
export type ShipmentLabel = z.infer<typeof shipmentLabelSchema>;

export const LABEL_FAILURE_REASONS = [
  "timeout",
  "timeout_unconfirmed",
  "http_error",
  "rate_limit_exhausted",
  "rejected",
  "insufficient_funds",
  "misconfigured",
] as const;

export type LabelFailureReason = (typeof LABEL_FAILURE_REASONS)[number];

export type LabelFailureCopy = {
  title: string;
  body: string;
  nextStep: string;
};

const LABEL_FAILURE_COPY: Record<LabelFailureReason, LabelFailureCopy> = {
  timeout: {
    title: "The carrier took too long to answer",
    body: "No label was bought and nothing has been recorded against this order.",
    nextStep: "Wait a moment and try again.",
  },
  timeout_unconfirmed: {
    title: "We could not confirm the label was bought",
    body: "Nothing has been recorded, so this order is still ready to ship. A label may or may not have been created.",
    nextStep:
      "Wait a minute and try again. If a duplicate label turns up in ShipStation, void it there.",
  },
  http_error: {
    title: "ShipStation could not be reached",
    body: "No label was bought and nothing has been recorded against this order.",
    nextStep:
      "Try again in a minute. If it keeps failing, check ShipStation's status page.",
  },
  rate_limit_exhausted: {
    title: "Too many requests to ShipStation",
    body: "We are being asked to slow down, so the label was not bought.",
    nextStep: "Wait about a minute and try again.",
  },
  rejected: {
    title: "The carrier would not accept this shipment",
    body: "Usually the delivery address or the parcel size and weight is the problem.",
    nextStep:
      "Check the delivery address on the order, then check the weight and dimensions and try again.",
  },
  insufficient_funds: {
    title: "Your ShipStation balance is too low",
    body: "The carrier needs the postage paid up front and there is not enough in the account.",
    nextStep: "Add funds in ShipStation, then buy the label again.",
  },
  misconfigured: {
    title: "Shipping is not set up correctly",
    body: "The shop's own ship-from address or carrier settings are incomplete, so no label can be bought.",
    nextStep: "This one needs a developer — send them this message.",
  },
};

export function describeLabelFailure(
  reason: LabelFailureReason,
  carrierMessage?: string | null,
): LabelFailureCopy {
  const copy = LABEL_FAILURE_COPY[reason];
  if (!carrierMessage) return copy;
  return { ...copy, body: `${copy.body} The carrier said: ${carrierMessage}` };
}

export function describeInternalFailure(
  detail?: string | null,
): LabelFailureCopy {
  return {
    title: "Something went wrong on our side",
    body: "No label was recorded, so this order is still ready to ship.",
    nextStep: detail
      ? `Try again. If it keeps happening, send a developer this: ${detail}`
      : "Try again. If it keeps happening, send a developer this message.",
  };
}

export function formatDeliveryWindow(
  deliveryDays: number | null,
  estimatedDeliveryDate: string | null,
): string {
  if (estimatedDeliveryDate) {
    const date = new Date(estimatedDeliveryDate);
    if (!Number.isNaN(date.getTime())) {
      const formatted = new Intl.DateTimeFormat("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      }).format(date);
      return `Arrives ${formatted}`;
    }
  }

  if (deliveryDays !== null && deliveryDays > 0) {
    return deliveryDays === 1
      ? "1 business day"
      : `${deliveryDays} business days`;
  }

  return "Delivery window not quoted";
}

export function formatParcelSummary(parcel: ParcelOverride): string {
  const { weight, length, width, height } = parcel;
  return `${weight} g · ${length} × ${width} × ${height} cm`;
}
