import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { MedusaContainer } from "@medusajs/framework/types";
import type {
  CheckoutLineItemDetail,
  OrderAddress,
  OrderConfirmation,
  OrderConfirmationLine,
  OrderStatus,
  OrderTracking,
} from "@craftynp/types";

import { ORDER_STATUS_MODULE } from "../modules/order-status";
import type OrderStatusModuleService from "../modules/order-status/service";
import { toAmount } from "./money";
import { loadOrderTracking } from "./order-status-detail";

export const ORDER_CONFIRMATION_FIELDS = [
  "id",
  "display_id",
  "email",
  "created_at",
  "status",
  "currency_code",
  "customer_id",
  "item_subtotal",
  "shipping_subtotal",
  "tax_total",
  "total",
  "items.*",
  "shipping_methods.*",
  "shipping_address.first_name",
  "shipping_address.last_name",
  "shipping_address.phone",
  "shipping_address.address_1",
  "shipping_address.address_2",
  "shipping_address.city",
  "shipping_address.province",
  "shipping_address.postal_code",
  "shipping_address.country_code",
];

type BigNumberish =
  number | string | Record<string, unknown> | null | undefined;

type OrderRow = {
  id: string;
  display_id: number | null;
  email: string | null;
  created_at: string | Date | null;
  status: string | null;
  currency_code: string | null;
  customer_id: string | null;
  item_subtotal: BigNumberish;
  shipping_subtotal: BigNumberish;
  tax_total: BigNumberish;
  total: BigNumberish;
  items?: OrderItemRow[] | null;
  shipping_address?: OrderAddressRow | null;
  shipping_methods?: { name: string | null }[] | null;
};

type OrderItemRow = {
  id: string;
  title: string | null;
  variant_title: string | null;
  thumbnail: string | null;
  quantity: number | null;
  unit_price: BigNumberish;
  metadata?: Record<string, unknown> | null;
};

type OrderAddressRow = {
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  address_1: string | null;
  address_2: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  country_code: string | null;
};

function toDetails(value: unknown): CheckoutLineItemDetail[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (entry == null || typeof entry !== "object") return [];
    const record = entry as Record<string, unknown>;
    if (typeof record.label !== "string" || typeof record.value !== "string") {
      return [];
    }
    return [{ label: record.label, value: record.value }];
  });
}

function toLine(item: OrderItemRow): OrderConfirmationLine {
  const quantity = item.quantity ?? 1;
  const unitPrice = toAmount(item.unit_price);

  return {
    id: item.id,
    title: item.title ?? "",
    variantTitle: item.variant_title,
    thumbnail: item.thumbnail,
    quantity,
    unitPrice,
    lineTotal: unitPrice * quantity,
    isCustomizable: item.metadata?.isCustomizable === true,
    details: toDetails(item.metadata?.details),
  };
}

function toAddress(
  row: OrderAddressRow | null | undefined,
): OrderAddress | null {
  if (!row) return null;

  return {
    firstName: row.first_name ?? "",
    lastName: row.last_name ?? "",
    phone: row.phone,
    address1: row.address_1 ?? "",
    address2: row.address_2 ?? "",
    city: row.city ?? "",
    state: row.province ?? "",
    postalCode: row.postal_code ?? "",
    countryCode: row.country_code ?? "",
  };
}

export type OrderFulfilmentSnapshot = {
  fulfilmentStatus: OrderStatus;
  tracking: OrderTracking | null;
};

export function toOrderConfirmation(
  row: OrderRow,
  fulfilment: OrderFulfilmentSnapshot = {
    fulfilmentStatus: "received",
    tracking: null,
  },
): OrderConfirmation {
  const createdAt = row.created_at ? new Date(row.created_at) : null;

  return {
    orderId: row.id,
    displayId: row.display_id ?? 0,
    email: row.email ?? "",
    placedAt:
      createdAt && !Number.isNaN(createdAt.getTime())
        ? createdAt.toISOString()
        : "",
    status: row.status ?? "",
    fulfilmentStatus: fulfilment.fulfilmentStatus,
    tracking: fulfilment.tracking,
    shippingMethodName: row.shipping_methods?.[0]?.name ?? null,
    lines: (row.items ?? []).map(toLine),
    totals: {
      subtotal: toAmount(row.item_subtotal),
      shipping: toAmount(row.shipping_subtotal),
      tax: toAmount(row.tax_total),
      total: toAmount(row.total),
      currencyCode: row.currency_code ?? "usd",
    },
    shippingAddress: toAddress(row.shipping_address),
    isGuest: row.customer_id == null,
  };
}

export type LoadedOrderConfirmation = {
  order: OrderConfirmation;
  customerId: string | null;
};

export async function loadOrderConfirmation(
  scope: MedusaContainer,
  orderId: string,
): Promise<LoadedOrderConfirmation | null> {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY);

  const { data: orders } = await query.graph({
    entity: "order",
    fields: ORDER_CONFIRMATION_FIELDS,
    filters: { id: orderId },
  });

  const row = orders[0] as OrderRow | undefined;
  if (!row) return null;

  const orderStatus =
    scope.resolve<OrderStatusModuleService>(ORDER_STATUS_MODULE);

  const [fulfilmentStatus, tracking] = await Promise.all([
    orderStatus.currentStatus(row.id),
    loadOrderTracking(scope, row.id),
  ]);

  return {
    order: toOrderConfirmation(row, { fulfilmentStatus, tracking }),
    customerId: row.customer_id,
  };
}
