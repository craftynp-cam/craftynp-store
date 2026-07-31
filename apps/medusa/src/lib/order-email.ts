import type { OrderConfirmation } from "@craftynp/types";

import { formatMoney } from "./format-money";
import { orderAccessTtlMs, signOrderAccessToken } from "./order-access-token";
import {
  renderAddressHtml,
  renderAddressText,
  renderOrderItemsHtml,
  renderOrderItemsText,
} from "./order-email-render";

export const ORDER_EMAIL_FAILED_LOG_TAG = "[email:order-failed]";

export function orderReference(displayId: number): string {
  return `#CNP-${displayId}`;
}

export function formatOrderDate(isoDate: string): string {
  if (!isoDate) return "";
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function storefrontUrl(): string {
  return (process.env.STOREFRONT_URL ?? "http://localhost:8000").replace(
    /\/+$/,
    "",
  );
}

// Mirrors the storefront's checkoutConfirmationHref(). The two builders are
// deliberately independent, so the order/number/token contract is written down
// in both apps' AGENTS.md.
export function orderConfirmationUrl(order: OrderConfirmation): string {
  const token = signOrderAccessToken(
    {
      oid: order.orderId,
      exp:
        Date.now() +
        orderAccessTtlMs(Number(process.env.ORDER_ACCESS_TOKEN_TTL_DAYS)),
    },
    process.env.ORDER_ACCESS_SECRET ?? "",
  );

  const params = new URLSearchParams({
    order: order.orderId,
    number: String(order.displayId),
    token,
  });

  return `${storefrontUrl()}/checkout/confirmation?${params.toString()}`;
}

export function customerFirstName(order: OrderConfirmation): string {
  return order.shippingAddress?.firstName || "there";
}

export type OrderEmailNotes = {
  turnaroundNote: string;
  shippingWindowNote: string;
};

export function orderConfirmationVariables(
  order: OrderConfirmation,
  notes: OrderEmailNotes,
): Record<string, string> {
  const orderUrl = orderConfirmationUrl(order);
  const { currencyCode } = order.totals;

  return {
    ORDER_NUMBER: orderReference(order.displayId),
    ORDER_DATE: formatOrderDate(order.placedAt),
    ORDER_URL: orderUrl,
    SHOP_URL: `${storefrontUrl()}/products`,
    CUSTOMER_NAME: customerFirstName(order),
    ORDER_ITEMS_HTML: renderOrderItemsHtml(order.lines, currencyCode, orderUrl),
    ORDER_ITEMS_TEXT: renderOrderItemsText(order.lines, currencyCode),
    SUBTOTAL: formatMoney(order.totals.subtotal, currencyCode),
    SHIPPING: formatMoney(order.totals.shipping, currencyCode),
    TAX: formatMoney(order.totals.tax, currencyCode),
    TOTAL: formatMoney(order.totals.total, currencyCode),
    SHIPPING_ADDRESS_HTML: renderAddressHtml(order.shippingAddress),
    SHIPPING_ADDRESS_TEXT: renderAddressText(order.shippingAddress),
    SHIPPING_METHOD: order.shippingMethodName ?? "Standard shipping",
    TURNAROUND_NOTE: notes.turnaroundNote,
    SHIPPING_WINDOW_NOTE: notes.shippingWindowNote,
    SHOP_ADDRESS: process.env.SHOP_POSTAL_ADDRESS ?? "The Crafty NP",
  };
}

export type ShipmentDetails = {
  carrierName: string;
  trackingNumber: string;
  trackingUrl: string;
  shipDate: string;
};

export function orderShippedVariables(
  order: OrderConfirmation,
  shipment: ShipmentDetails,
): Record<string, string> {
  const orderUrl = orderConfirmationUrl(order);
  const { currencyCode } = order.totals;

  return {
    ORDER_NUMBER: orderReference(order.displayId),
    SHIP_DATE: shipment.shipDate,
    ORDER_URL: orderUrl,
    SHOP_URL: `${storefrontUrl()}/products`,
    CUSTOMER_NAME: customerFirstName(order),
    ORDER_ITEMS_HTML: renderOrderItemsHtml(order.lines, currencyCode, orderUrl),
    ORDER_ITEMS_TEXT: renderOrderItemsText(order.lines, currencyCode),
    CARRIER_NAME: shipment.carrierName,
    TRACKING_NUMBER: shipment.trackingNumber,
    TRACKING_URL: shipment.trackingUrl || orderUrl,
    SHIPPING_ADDRESS_HTML: renderAddressHtml(order.shippingAddress),
    SHIPPING_ADDRESS_TEXT: renderAddressText(order.shippingAddress),
    SHOP_ADDRESS: process.env.SHOP_POSTAL_ADDRESS ?? "The Crafty NP",
  };
}
