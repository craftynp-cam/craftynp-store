import type { OrderStatus, TrackingStatus } from "@craftynp/types";

import type { BadgeTone } from "@/components";

export type OrderStatusCopy = {
  label: string;
  description: string;
  tone: BadgeTone;
};

export const ORDER_STATUS_COPY = {
  received: {
    label: "Order received",
    description: "I've got your order and I'll start on it shortly.",
    tone: "neutral",
  },
  packing: {
    label: "Getting it ready",
    description: "Your order is being packed.",
    tone: "accent",
  },
  in_production: {
    label: "Being made",
    description: "Your pieces are being made by hand right now.",
    tone: "accent",
  },
  shipped: {
    label: "On its way",
    description: "Your parcel is with the carrier.",
    tone: "accent",
  },
  delivered: {
    label: "Delivered",
    description: "Your parcel has arrived.",
    tone: "success",
  },
  cancelled: {
    label: "Cancelled",
    description: "This order was cancelled.",
    tone: "danger",
  },
} as const satisfies Record<OrderStatus, OrderStatusCopy>;

export const TRACKING_STATUS_COPY = {
  accepted: "Accepted by the carrier",
  in_transit: "In transit",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  exception: "There's a delay — check with the carrier",
  unknown: "Awaiting the first scan",
} as const satisfies Record<TrackingStatus, string>;
