import { allowedTransitions, carrierTrackingUrl } from "@craftynp/types";
import type { MedusaContainer } from "@medusajs/framework/types";
import type {
  OrderStatus,
  OrderStatusDetail,
  OrderStatusHistoryEntry,
  OrderTracking,
  TrackingStatus,
} from "@craftynp/types";

import { ORDER_STATUS_MODULE } from "../modules/order-status";
import type OrderStatusModuleService from "../modules/order-status/service";

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function loadOrderTracking(
  scope: MedusaContainer,
  orderId: string,
): Promise<OrderTracking | null> {
  const service = scope.resolve<OrderStatusModuleService>(ORDER_STATUS_MODULE);
  const shipment = await service.activeShipment(orderId);
  if (!shipment) return null;

  return {
    trackingNumber: shipment.tracking_number,
    trackingUrl: carrierTrackingUrl(
      shipment.carrier_code,
      shipment.tracking_number,
    ),
    carrierCode: shipment.carrier_code,
    carrierName: shipment.carrier_code,
    status: shipment.tracking_status as TrackingStatus,
    statusDescription: shipment.tracking_status_description,
    shippedAt: toIso(shipment.shipped_at),
    deliveredAt: toIso(shipment.delivered_at),
  };
}

export async function loadOrderStatusDetail(
  scope: MedusaContainer,
  orderId: string,
): Promise<OrderStatusDetail> {
  const service = scope.resolve<OrderStatusModuleService>(ORDER_STATUS_MODULE);

  const status = await service.currentStatus(orderId);
  const rows = await service.listHistory(orderId);
  const tracking = await loadOrderTracking(scope, orderId);

  const history: OrderStatusHistoryEntry[] = rows.map((row) => ({
    id: row.id,
    fromStatus: (row.from_status as OrderStatus | null) ?? null,
    toStatus: row.to_status as OrderStatus,
    reason: row.reason,
    actorType: row.actor_type as OrderStatusHistoryEntry["actorType"],
    actorId: row.actor_id,
    createdAt: toIso(row.created_at) ?? "",
  }));

  return {
    orderId,
    status,
    allowedTransitions: [...allowedTransitions(status)],
    tracking,
    history,
  };
}
