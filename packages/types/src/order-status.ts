import { z } from "zod";

import { shipmentLabelSchema } from "./fulfilment.js";

export const ORDER_STATUSES = [
  "received",
  "packing",
  "in_production",
  "shipped",
  "delivered",
  "cancelled",
] as const;

export const orderStatusSchema = z.enum(ORDER_STATUSES);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

export const ORDER_STATUS_TRANSITIONS = {
  received: ["packing", "cancelled"],
  packing: ["in_production", "shipped", "cancelled"],
  in_production: ["packing", "shipped", "cancelled"],
  shipped: ["delivered", "packing"],
  delivered: [],
  cancelled: [],
} as const satisfies Record<OrderStatus, readonly OrderStatus[]>;

export const TERMINAL_ORDER_STATUSES = ORDER_STATUSES.filter(
  (status) => ORDER_STATUS_TRANSITIONS[status].length === 0,
);

function readable(status: OrderStatus): string {
  return status.replace(/_/g, " ");
}

function joinReadable(statuses: readonly OrderStatus[]): string {
  const words = statuses.map(readable);
  if (words.length <= 1) return words[0] ?? "";
  return `${words.slice(0, -1).join(", ")} or ${words[words.length - 1]}`;
}

export function allowedTransitions(from: OrderStatus): readonly OrderStatus[] {
  return ORDER_STATUS_TRANSITIONS[from];
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return (ORDER_STATUS_TRANSITIONS[from] as readonly OrderStatus[]).includes(
    to,
  );
}

export function transitionRejection(
  from: OrderStatus,
  to: OrderStatus,
): string | null {
  if (canTransition(from, to)) return null;

  if (from === to) {
    return `This order is already ${readable(from)}.`;
  }

  const allowed = ORDER_STATUS_TRANSITIONS[from];
  if (allowed.length === 0) {
    return `This order is ${readable(from)}, which is final. It cannot become ${readable(to)}.`;
  }

  return `An order that is ${readable(from)} cannot become ${readable(to)}. From here it can only become ${joinReadable(allowed)}.`;
}

export const TRACKING_STATUSES = [
  "accepted",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "exception",
  "unknown",
] as const;

export const trackingStatusSchema = z.enum(TRACKING_STATUSES);
export type TrackingStatus = z.infer<typeof trackingStatusSchema>;

const SHIPSTATION_TRACKING_STATUS: Record<string, TrackingStatus> = {
  AC: "accepted",
  NY: "in_transit",
  IT: "in_transit",
  AT: "exception",
  EX: "exception",
  DE: "delivered",
  SP: "delivered",
  UN: "unknown",
};

export function trackingStatusFromShipStation(
  statusCode: string | null | undefined,
  carrierStatusDescription?: string | null,
): TrackingStatus {
  const status = SHIPSTATION_TRACKING_STATUS[(statusCode ?? "").toUpperCase()];
  if (!status) return "unknown";

  if (
    status === "in_transit" &&
    /out for delivery|with delivery courier/i.test(
      carrierStatusDescription ?? "",
    )
  ) {
    return "out_for_delivery";
  }

  return status;
}

const CARRIER_TRACKING_URLS: Record<string, (tracking: string) => string> = {
  usps: (t) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${t}`,
  stamps_com: (t) =>
    `https://tools.usps.com/go/TrackConfirmAction?tLabels=${t}`,
  ups: (t) => `https://www.ups.com/track?tracknum=${t}`,
  fedex: (t) => `https://www.fedex.com/fedextrack/?trknbr=${t}`,
  dhl_express: (t) => `https://www.dhl.com/en/express/tracking.html?AWB=${t}`,
};

export function carrierTrackingUrl(
  carrierCode: string | null | undefined,
  trackingNumber: string | null | undefined,
): string | null {
  const tracking = (trackingNumber ?? "").trim();
  if (!tracking) return null;

  const build = CARRIER_TRACKING_URLS[(carrierCode ?? "").trim().toLowerCase()];
  if (!build) return null;

  return build(encodeURIComponent(tracking));
}

export const orderTrackingSchema = z.object({
  trackingNumber: z.string().min(1),
  trackingUrl: z.string().nullable(),
  carrierCode: z.string().nullable(),
  carrierName: z.string().nullable(),
  status: trackingStatusSchema,
  statusDescription: z.string().nullable(),
  shippedAt: z.string().nullable(),
  deliveredAt: z.string().nullable(),
});
export type OrderTracking = z.infer<typeof orderTrackingSchema>;

export const orderStatusActorSchema = z.enum(["user", "system", "webhook"]);
export type OrderStatusActor = z.infer<typeof orderStatusActorSchema>;

export const orderStatusHistoryEntrySchema = z.object({
  id: z.string().min(1),
  fromStatus: orderStatusSchema.nullable(),
  toStatus: orderStatusSchema,
  reason: z.string().nullable(),
  actorType: orderStatusActorSchema,
  actorId: z.string().nullable(),
  createdAt: z.string(),
});
export type OrderStatusHistoryEntry = z.infer<
  typeof orderStatusHistoryEntrySchema
>;

export const orderStatusDetailSchema = z.object({
  orderId: z.string().min(1),
  status: orderStatusSchema,
  allowedTransitions: z.array(orderStatusSchema),
  tracking: orderTrackingSchema.nullable(),
  label: shipmentLabelSchema.nullable(),
  history: z.array(orderStatusHistoryEntrySchema),
});
export type OrderStatusDetail = z.infer<typeof orderStatusDetailSchema>;

export const orderStatusDetailResponseSchema = z.object({
  orderStatus: orderStatusDetailSchema,
});
export type OrderStatusDetailResponse = z.infer<
  typeof orderStatusDetailResponseSchema
>;

export const orderStatusUpdateRequestSchema = z.object({
  status: orderStatusSchema,
  reason: z.string().max(500).optional(),
});
export type OrderStatusUpdateRequest = z.infer<
  typeof orderStatusUpdateRequestSchema
>;

export const recordShipmentRequestSchema = z.object({
  trackingNumber: z.string().min(1).max(64),
  carrierCode: z.string().min(1).max(40),
  serviceCode: z.string().min(1).max(60).optional(),
  labelId: z.string().min(1).max(60).optional(),
  labelUrl: z.string().min(1).max(2048).optional(),
});
export type RecordShipmentRequest = z.infer<typeof recordShipmentRequestSchema>;

export const voidShipmentRequestSchema = z.object({
  reason: z.string().max(500).optional(),
});
export type VoidShipmentRequest = z.infer<typeof voidShipmentRequestSchema>;
