import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { MedusaContainer } from "@medusajs/framework/types";
import type {
  CheckoutLineItemDetail,
  OrderAddress,
  OrderConfirmation,
  OrderConfirmationLine,
} from "@craftynp/types";

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
  "items.id",
  "items.title",
  "items.variant_title",
  "items.thumbnail",
  "items.quantity",
  "items.unit_price",
  "items.metadata",
  "shipping_address.first_name",
  "shipping_address.last_name",
  "shipping_address.phone",
  "shipping_address.address_1",
  "shipping_address.address_2",
  "shipping_address.city",
  "shipping_address.province",
  "shipping_address.postal_code",
  "shipping_address.country_code",
  "shipping_methods.name",
];

type OrderRow = {
  id: string;
  display_id: number | null;
  email: string | null;
  created_at: string | Date | null;
  status: string | null;
  currency_code: string | null;
  customer_id: string | null;
  item_subtotal: number | null;
  shipping_subtotal: number | null;
  tax_total: number | null;
  total: number | null;
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
  unit_price: number | null;
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
  const unitPrice = item.unit_price ?? 0;

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

export function toOrderConfirmation(row: OrderRow): OrderConfirmation {
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
    shippingMethodName: row.shipping_methods?.[0]?.name ?? null,
    lines: (row.items ?? []).map(toLine),
    totals: {
      subtotal: row.item_subtotal ?? 0,
      shipping: row.shipping_subtotal ?? 0,
      tax: row.tax_total ?? 0,
      total: row.total ?? 0,
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

  return { order: toOrderConfirmation(row), customerId: row.customer_id };
}
