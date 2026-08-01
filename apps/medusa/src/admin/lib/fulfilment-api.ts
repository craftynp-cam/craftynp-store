import type {
  BuyLabelRequest,
  FulfilmentQueueResponse,
  OrderStatusDetail,
  ParcelOverride,
  RateShipmentResponse,
} from "@craftynp/types";

import { sdk } from "./client";

export type OrderStatusResponse = { orderStatus: OrderStatusDetail };

export type BuyLabelResponse = OrderStatusResponse & {
  label: {
    trackingNumber: string;
    carrierCode: string;
    serviceCode: string;
    shipmentCost: number;
    currencyCode: string;
    labelStored: boolean;
  };
};

export type VoidLabelResponse = OrderStatusResponse & {
  voidApproved: boolean | null;
  voidMessage: string | null;
};

export const queueQueryKey = ["fulfilment-queue"];
export const balanceQueryKey = ["fulfilment-balance"];

export function orderStatusQueryKey(orderId: string): string[] {
  return ["order-status", orderId];
}

export function fetchQueue(): Promise<FulfilmentQueueResponse> {
  return sdk.client.fetch<FulfilmentQueueResponse>("/admin/fulfilment/queue");
}

export function fetchOrderStatus(
  orderId: string,
): Promise<OrderStatusResponse> {
  return sdk.client.fetch<OrderStatusResponse>(
    `/admin/orders/${orderId}/status`,
  );
}

export function fetchRates(
  orderId: string,
  parcel: ParcelOverride | null,
): Promise<RateShipmentResponse> {
  return sdk.client.fetch<RateShipmentResponse>(
    `/admin/orders/${orderId}/shipment/rates`,
    { method: "POST", body: parcel ? { parcel } : {} },
  );
}

export function buyLabel(
  orderId: string,
  body: BuyLabelRequest,
): Promise<BuyLabelResponse> {
  return sdk.client.fetch<BuyLabelResponse>(
    `/admin/orders/${orderId}/shipment/buy`,
    { method: "POST", body },
  );
}

export function voidLabel(orderId: string): Promise<VoidLabelResponse> {
  return sdk.client.fetch<VoidLabelResponse>(
    `/admin/orders/${orderId}/shipment/void`,
    { method: "POST", body: {} },
  );
}

export function labelPdfPath(orderId: string): string {
  return `/admin/fulfilment/labels/${orderId}`;
}

export function describeFailure(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Something went wrong. Please try again.";
}
