import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { Logger } from "@medusajs/framework/types";

import { toAmount } from "../../lib/money";
import { ORDER_STATUS_LOG_TAG } from "../../modules/order-status/lib";

export type ReservationToCreate = {
  line_item_id: string;
  inventory_item_id: string;
  location_id: string;
  quantity: number;
};

type InventoryItemRow = {
  inventory?: {
    id?: string | null;
    location_levels?: { location_id?: string | null }[] | null;
  } | null;
  required_quantity?: number | null;
};

type OrderRow = {
  items?:
    | {
        id: string;
        quantity: unknown;
        variant?: {
          manage_inventory?: boolean | null;
          inventory_items?: InventoryItemRow[] | null;
        } | null;
      }[]
    | null;
  fulfillments?:
    | { location_id?: string | null; canceled_at?: string | Date | null }[]
    | null;
};

const ORDER_FIELDS = [
  "id",
  "items.*",
  "items.variant.manage_inventory",
  "items.variant.inventory_items.required_quantity",
  "items.variant.inventory_items.inventory.id",
  "items.variant.inventory_items.inventory.location_levels.location_id",
  "fulfillments.location_id",
  "fulfillments.canceled_at",
];

function pickStockedLocation(
  inventoryItem: InventoryItemRow,
  preferred: string | null,
): string | null {
  const stocked = (inventoryItem.inventory?.location_levels ?? [])
    .map((level) => level.location_id)
    .filter((id): id is string => typeof id === "string" && id !== "");

  if (stocked.length === 0) return null;
  if (preferred && stocked.includes(preferred)) return preferred;

  return stocked[0] ?? null;
}

export function buildReservationsToCreate(
  order: OrderRow,
  reservedLineItemIds: ReadonlySet<string>,
): ReservationToCreate[] {
  const fulfilled = (order.fulfillments ?? []).some(
    (fulfillment) => !fulfillment.canceled_at,
  );

  if (!fulfilled) return [];

  const preferred =
    (order.fulfillments ?? []).find(
      (fulfillment) => !fulfillment.canceled_at && fulfillment.location_id,
    )?.location_id ?? null;

  const reservations: ReservationToCreate[] = [];

  for (const item of order.items ?? []) {
    if (!item.variant?.manage_inventory) continue;
    if (reservedLineItemIds.has(item.id)) continue;

    for (const inventoryItem of item.variant.inventory_items ?? []) {
      const inventoryItemId = inventoryItem.inventory?.id;
      if (!inventoryItemId) continue;

      const locationId = pickStockedLocation(inventoryItem, preferred);
      if (!locationId) continue;

      const quantity =
        toAmount(item.quantity) * (inventoryItem.required_quantity ?? 1);
      if (!Number.isFinite(quantity) || quantity <= 0) continue;

      reservations.push({
        line_item_id: item.id,
        inventory_item_id: inventoryItemId,
        location_id: locationId,
        quantity,
      });
    }
  }

  return reservations;
}

export const restoreReservationsStep = createStep(
  "restore-reservations",
  async (input: { orderId: string }, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);

    const { data: orders } = await query.graph({
      entity: "order",
      fields: ORDER_FIELDS,
      filters: { id: input.orderId },
    });

    const order = (orders as OrderRow[])[0];
    if (!order) return new StepResponse<ReservationToCreate[]>([]);

    const lineItemIds = (order.items ?? []).map((item) => item.id);
    const reservedLineItemIds = new Set<string>();

    if (lineItemIds.length > 0) {
      const { data: existing } = await query.graph({
        entity: "reservation",
        fields: ["line_item_id"],
        filters: { line_item_id: lineItemIds },
      });

      for (const row of existing as { line_item_id?: string | null }[]) {
        if (row.line_item_id) reservedLineItemIds.add(row.line_item_id);
      }
    }

    const reservations = buildReservationsToCreate(order, reservedLineItemIds);

    if (reservations.length === 0) {
      logger.warn(
        `${ORDER_STATUS_LOG_TAG} reason=reservations_not_restored order=${input.orderId}`,
      );
    }

    return new StepResponse(reservations);
  },
);
