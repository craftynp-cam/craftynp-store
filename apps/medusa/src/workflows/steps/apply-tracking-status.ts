import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import type { TrackingStatus } from "@craftynp/types";

import { ORDER_STATUS_MODULE } from "../../modules/order-status";
import type OrderStatusModuleService from "../../modules/order-status/service";

export type ApplyTrackingStatusStepInput = {
  shipmentId: string;
  statusCode: string;
  statusDescription: string | null;
  carrierStatusDescription: string | null;
};

type ShipmentSnapshot = {
  tracking_status: string;
  tracking_status_description: string | null;
  delivered_at: Date | string | null;
};

type CompensationInput = {
  shipmentId: string;
  tracking_status: string;
  tracking_status_description: string | null;
  delivered_at: Date | null;
};

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export const applyTrackingStatusStep = createStep(
  "apply-tracking-status",
  async (input: ApplyTrackingStatusStepInput, { container }) => {
    const service = container.resolve<OrderStatusModuleService>(
      ORDER_STATUS_MODULE,
    );

    const [previous] = (await service.listShipmentTrackings({
      id: input.shipmentId,
    })) as ShipmentSnapshot[];

    const status = await service.applyTrackingStatus(
      input.shipmentId,
      input.statusCode,
      input.carrierStatusDescription,
      input.statusDescription,
    );

    return new StepResponse({ status } as { status: TrackingStatus }, {
      shipmentId: input.shipmentId,
      tracking_status: previous?.tracking_status ?? "unknown",
      tracking_status_description: previous?.tracking_status_description ?? null,
      delivered_at: toDate(previous?.delivered_at),
    } satisfies CompensationInput);
  },
  async (compensationInput: CompensationInput | undefined, { container }) => {
    if (!compensationInput) return;

    const service = container.resolve<OrderStatusModuleService>(
      ORDER_STATUS_MODULE,
    );

    await service.updateShipmentTrackings({
      id: compensationInput.shipmentId,
      tracking_status: compensationInput.tracking_status,
      tracking_status_description:
        compensationInput.tracking_status_description,
      delivered_at: compensationInput.delivered_at,
    });
  },
);
