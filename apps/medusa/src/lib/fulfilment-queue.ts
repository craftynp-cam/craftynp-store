import type {
  ParcelOverride,
  PrintableLabel,
  QueueEntry,
  QueueItem,
} from "@craftynp/types";

import {
  packItemsIntoOneBox,
  type PackableItem,
  type ShipStationAddress,
} from "../modules/shipstation/lib";

export type OrderAddressRow = {
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  company?: string | null;
  address_1?: string | null;
  address_2?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
  country_code?: string | null;
};

export type OrderItemRow = {
  id: string;
  title?: string | null;
  variant_title?: string | null;
  variant_sku?: string | null;
  variant_id?: string | null;
  quantity: number;
};

export type OrderRow = {
  id: string;
  display_id?: number | null;
  created_at?: string | Date | null;
  email?: string | null;
  items?: OrderItemRow[] | null;
  shipping_address?: OrderAddressRow | null;
};

export type VariantDimensions = {
  id: string;
  title?: string | null;
  weight?: number | null;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  product?: {
    title?: string | null;
    weight?: number | null;
    length?: number | null;
    width?: number | null;
    height?: number | null;
  } | null;
};

function fullName(address: OrderAddressRow): string {
  return [address.first_name, address.last_name]
    .filter((part) => typeof part === "string" && part.trim() !== "")
    .join(" ")
    .trim();
}

export function toShipStationAddress(
  address: OrderAddressRow | null | undefined,
): ShipStationAddress | null {
  if (!address) return null;

  const name = fullName(address);
  const addressLine1 = address.address_1 ?? "";
  const cityLocality = address.city ?? "";
  const stateProvince = address.province ?? "";
  const postalCode = address.postal_code ?? "";
  const countryCode = address.country_code ?? "";

  if (
    name === "" ||
    addressLine1 === "" ||
    cityLocality === "" ||
    postalCode === "" ||
    countryCode === ""
  ) {
    return null;
  }

  return {
    name,
    phone: address.phone ?? "",
    companyName: address.company ?? undefined,
    addressLine1,
    addressLine2: address.address_2 ?? undefined,
    cityLocality,
    stateProvince,
    postalCode,
    countryCode,
  };
}

function pickDimension(
  variant: VariantDimensions,
  key: "weight" | "length" | "width" | "height",
): number | null {
  const own = variant[key];
  if (typeof own === "number" && own > 0) return own;

  const fromProduct = variant.product?.[key];
  if (typeof fromProduct === "number" && fromProduct > 0) return fromProduct;

  return null;
}

export function deriveParcel(
  items: readonly OrderItemRow[],
  variantsById: ReadonlyMap<string, VariantDimensions>,
): { parcel: ParcelOverride | null; missing: string[] } {
  const packable: PackableItem[] = [];
  const titleByVariantId = new Map<string, string>();

  for (const item of items) {
    const variantId = item.variant_id ?? null;
    if (!variantId) {
      packable.push({
        variantId: item.id,
        quantity: item.quantity,
        weight: null,
        length: null,
        width: null,
        height: null,
      });
      titleByVariantId.set(item.id, item.title ?? "Untitled item");
      continue;
    }

    const variant = variantsById.get(variantId);
    titleByVariantId.set(
      variantId,
      variant?.product?.title ?? item.title ?? "Untitled item",
    );

    packable.push({
      variantId,
      quantity: item.quantity,
      weight: variant ? pickDimension(variant, "weight") : null,
      length: variant ? pickDimension(variant, "length") : null,
      width: variant ? pickDimension(variant, "width") : null,
      height: variant ? pickDimension(variant, "height") : null,
    });
  }

  const result = packItemsIntoOneBox(packable);

  if (!result.ok) {
    const missing = [
      ...new Set(
        result.missing.map((id) => titleByVariantId.get(id) ?? "Untitled item"),
      ),
    ];
    return { parcel: null, missing };
  }

  return { parcel: result.parcel, missing: [] };
}

function toIsoString(value: string | Date | null | undefined): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return "";
}

function toIso(value: string | Date | null | undefined): string | null {
  const iso = toIsoString(value);
  return iso === "" ? null : iso;
}

export function buildQueueEntries(
  orderIds: readonly string[],
  orders: readonly OrderRow[],
  variantsById: ReadonlyMap<string, VariantDimensions>,
): QueueEntry[] {
  const ordersById = new Map(orders.map((order) => [order.id, order]));
  const entries: QueueEntry[] = [];

  for (const orderId of orderIds) {
    const order = ordersById.get(orderId);
    if (!order) continue;

    const orderItems = order.items ?? [];
    const { parcel, missing } = deriveParcel(orderItems, variantsById);
    const address = order.shipping_address ?? null;

    const items: QueueItem[] = orderItems.map((item) => ({
      title: item.title ?? "Untitled item",
      variantTitle: item.variant_title ?? null,
      sku: item.variant_sku ?? null,
      quantity: item.quantity,
    }));

    entries.push({
      orderId: order.id,
      displayId: order.display_id ?? 0,
      placedAt: toIsoString(order.created_at),
      customerName: address ? fullName(address) : (order.email ?? ""),
      destination: address
        ? {
            name: fullName(address),
            phone: address.phone ?? null,
            addressLine1: address.address_1 ?? "",
            addressLine2: address.address_2 ?? null,
            city: address.city ?? "",
            state: address.province ?? "",
            postalCode: address.postal_code ?? "",
            countryCode: address.country_code ?? "",
          }
        : null,
      items,
      derivedParcel: parcel,
      missingDimensions: missing,
    });
  }

  return entries;
}

export const PRINTABLE_WINDOW_DAYS = 14;

export type PrintableRow = {
  orderId: string;
  trackingNumber: string;
  carrierCode: string | null;
  shippedAt: Date | string | null;
};

export function buildPrintableLabels(
  rows: readonly PrintableRow[],
  orders: readonly OrderRow[],
): PrintableLabel[] {
  const ordersById = new Map(orders.map((order) => [order.id, order]));
  const labels: PrintableLabel[] = [];

  for (const row of rows) {
    const order = ordersById.get(row.orderId);
    if (!order) continue;

    const address = order.shipping_address ?? null;

    labels.push({
      orderId: row.orderId,
      displayId: order.display_id ?? 0,
      customerName: address ? fullName(address) : (order.email ?? ""),
      trackingNumber: row.trackingNumber,
      carrierCode: row.carrierCode,
      shippedAt: toIso(row.shippedAt),
    });
  }

  return labels.sort((a, b) =>
    (b.shippedAt ?? "").localeCompare(a.shippedAt ?? ""),
  );
}
