import { MedusaService } from "@medusajs/framework/utils";
import { allowedTransitions, trackingStatusFromShipStation } from "@craftynp/types";
import type { OrderStatus, OrderStatusActor, TrackingStatus } from "@craftynp/types";

import { assertTransition, OrderStatusTransitionError } from "./lib";
import OrderStatusHistoryEntry from "./models/order-status-history-entry";
import OrderStatusRecord from "./models/order-status-record";
import ShipmentTracking from "./models/shipment-tracking";
import TrackingWebhookEvent from "./models/tracking-webhook-event";

export const INITIAL_ORDER_STATUS: OrderStatus = "received";

type StatusRow = {
  id: string;
  order_id: string;
  status: string;
  changed_at: Date | string | null;
};

type ShipmentRow = {
  id: string;
  tracking_number: string;
  fulfillment_id: string | null;
  carrier_code: string | null;
  service_code: string | null;
  label_id: string | null;
  label_url: string | null;
  tracking_status: string;
  tracking_status_description: string | null;
  shipped_at: Date | string | null;
  delivered_at: Date | string | null;
  voided_at: Date | string | null;
};

type HistoryRow = {
  id: string;
  from_status: string | null;
  to_status: string;
  reason: string | null;
  actor_type: string;
  actor_id: string | null;
  created_at: Date | string;
};

export type TransitionInput = {
  orderId: string;
  to: OrderStatus;
  reason?: string | null;
  actorType: OrderStatusActor;
  actorId?: string | null;
};

export type RecordShipmentInput = {
  orderId: string;
  trackingNumber: string;
  carrierCode: string;
  serviceCode?: string | null;
  labelId?: string | null;
  labelUrl?: string | null;
  fulfillmentId: string;
  shippedAt: Date;
};

export type TrackingEventInput = {
  eventKey: string;
  trackingNumber: string;
  statusCode: string;
  occurredAt: string | null;
};

class OrderStatusModuleService extends MedusaService({
  OrderStatusRecord,
  OrderStatusHistoryEntry,
  ShipmentTracking,
  TrackingWebhookEvent,
}) {
  async findRecord(orderId: string): Promise<StatusRow | null> {
    const rows = (await this.listOrderStatusRecords({
      order_id: orderId,
    })) as StatusRow[];
    return rows[0] ?? null;
  }

  async ensureRecord(orderId: string): Promise<StatusRow> {
    const existing = await this.findRecord(orderId);
    if (existing) return existing;

    const created = (await this.createOrderStatusRecords({
      order_id: orderId,
      status: INITIAL_ORDER_STATUS,
      changed_at: new Date(),
    })) as StatusRow | StatusRow[];

    return Array.isArray(created) ? (created[0] as StatusRow) : created;
  }

  async currentStatus(orderId: string): Promise<OrderStatus> {
    const record = await this.findRecord(orderId);
    return (record?.status as OrderStatus | undefined) ?? INITIAL_ORDER_STATUS;
  }

  async transition(
    input: TransitionInput,
  ): Promise<{ from: OrderStatus; to: OrderStatus; historyEntryId: string }> {
    const record = await this.ensureRecord(input.orderId);
    const from = record.status as OrderStatus;

    assertTransition(from, input.to);

    await this.updateOrderStatusRecords({
      id: record.id,
      status: input.to,
      changed_at: new Date(),
    });

    const entry = (await this.createOrderStatusHistoryEntries({
      order_status_id: record.id,
      from_status: from,
      to_status: input.to,
      reason: input.reason ?? null,
      actor_type: input.actorType,
      actor_id: input.actorId ?? null,
    })) as { id: string } | { id: string }[];

    return {
      from,
      to: input.to,
      historyEntryId: Array.isArray(entry) ? entry[0]!.id : entry.id,
    };
  }

  async revertTransition(input: {
    orderId: string;
    status: OrderStatus;
    historyEntryId?: string | null;
  }): Promise<void> {
    const record = await this.findRecord(input.orderId);
    if (!record) return;

    await this.updateOrderStatusRecords({
      id: record.id,
      status: input.status,
      changed_at: new Date(),
    });

    if (input.historyEntryId) {
      await this.deleteOrderStatusHistoryEntries(input.historyEntryId);
    }
  }

  async listHistory(orderId: string): Promise<HistoryRow[]> {
    const record = await this.findRecord(orderId);
    if (!record) return [];

    const rows = (await this.listOrderStatusHistoryEntries(
      { order_status_id: record.id },
      { order: { created_at: "DESC" } },
    )) as HistoryRow[];

    return rows;
  }

  async activeShipment(orderId: string): Promise<ShipmentRow | null> {
    const record = await this.findRecord(orderId);
    if (!record) return null;

    const rows = (await this.listShipmentTrackings({
      order_status_id: record.id,
      voided_at: null,
    })) as ShipmentRow[];

    return rows[0] ?? null;
  }

  async findShipmentByTrackingNumber(
    trackingNumber: string,
  ): Promise<(ShipmentRow & { order_status_id: string }) | null> {
    const rows = (await this.listShipmentTrackings({
      tracking_number: trackingNumber,
    })) as (ShipmentRow & { order_status_id: string })[];

    return rows[0] ?? null;
  }

  async recordShipment(input: RecordShipmentInput): Promise<ShipmentRow> {
    const record = await this.ensureRecord(input.orderId);

    const created = (await this.createShipmentTrackings({
      order_status_id: record.id,
      tracking_number: input.trackingNumber,
      carrier_code: input.carrierCode,
      service_code: input.serviceCode ?? null,
      label_id: input.labelId ?? null,
      label_url: input.labelUrl ?? null,
      fulfillment_id: input.fulfillmentId,
      tracking_status: "accepted" satisfies TrackingStatus,
      tracking_status_description: null,
      shipped_at: input.shippedAt,
      delivered_at: null,
      voided_at: null,
    })) as ShipmentRow | ShipmentRow[];

    return Array.isArray(created) ? (created[0] as ShipmentRow) : created;
  }

  async voidShipment(orderId: string): Promise<ShipmentRow> {
    const shipment = await this.activeShipment(orderId);
    if (!shipment) {
      throw new OrderStatusTransitionError(
        "no_shipment",
        "This order has no shipment to void.",
      );
    }

    await this.updateShipmentTrackings({
      id: shipment.id,
      voided_at: new Date(),
    });

    return shipment;
  }

  async applyTrackingStatus(
    shipmentId: string,
    statusCode: string,
    carrierStatusDescription: string | null,
    statusDescription: string | null,
  ): Promise<TrackingStatus> {
    const status = trackingStatusFromShipStation(
      statusCode,
      carrierStatusDescription,
    );

    await this.updateShipmentTrackings({
      id: shipmentId,
      tracking_status: status,
      tracking_status_description: statusDescription,
      ...(status === "delivered" ? { delivered_at: new Date() } : {}),
    });

    return status;
  }

  async shipmentContext(trackingNumber: string): Promise<{
    shipment: ShipmentRow;
    orderId: string;
    status: OrderStatus;
  } | null> {
    const shipment = await this.findShipmentByTrackingNumber(trackingNumber);
    if (!shipment) return null;

    const [record] = (await this.listOrderStatusRecords({
      id: shipment.order_status_id,
    })) as StatusRow[];

    if (!record) return null;

    return {
      shipment,
      orderId: record.order_id,
      status: record.status as OrderStatus,
    };
  }

  async releaseWebhookEvent(eventKey: string): Promise<void> {
    const existing = (await this.listTrackingWebhookEvents({
      event_key: eventKey,
    })) as { id: string }[];

    if (existing[0]) {
      await this.deleteTrackingWebhookEvents(existing[0].id);
    }
  }

  async recordWebhookEvent(input: TrackingEventInput): Promise<boolean> {
    try {
      await this.createTrackingWebhookEvents({
        event_key: input.eventKey,
        tracking_number: input.trackingNumber,
        status_code: input.statusCode,
        occurred_at: input.occurredAt ? new Date(input.occurredAt) : null,
      });
      return true;
    } catch (error) {
      const existing = (await this.listTrackingWebhookEvents({
        event_key: input.eventKey,
      })) as { id: string }[];

      if (existing.length > 0) return false;
      throw error;
    }
  }

  allowedTransitionsFrom(status: OrderStatus): OrderStatus[] {
    return [...allowedTransitions(status)];
  }
}

export default OrderStatusModuleService;
