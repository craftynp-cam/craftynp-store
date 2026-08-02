import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";

import { ORDER_STATUS_MODULE } from "../../modules/order-status";
import type OrderStatusModuleService from "../../modules/order-status/service";

export type RecordShipmentTrackingStepInput = {
  orderId: string;
  trackingNumber: string;
  carrierCode: string;
  carrierId?: string | null;
  serviceCode?: string | null;
  labelId?: string | null;
  labelUrl?: string | null;
  labelFileId?: string | null;
  shipmentCost?: number | null;
  currencyCode?: string | null;
  fulfillmentId: string;
};

export const recordShipmentTrackingStep = createStep(
  "record-shipment-tracking",
  async (input: RecordShipmentTrackingStepInput, { container }) => {
    const service =
      container.resolve<OrderStatusModuleService>(ORDER_STATUS_MODULE);

    const shipment = await service.recordShipment({
      ...input,
      shippedAt: new Date(),
    });

    return new StepResponse(shipment, { shipmentId: shipment.id });
  },
  async (
    compensationInput: { shipmentId: string } | undefined,
    { container },
  ) => {
    if (!compensationInput) return;

    const service =
      container.resolve<OrderStatusModuleService>(ORDER_STATUS_MODULE);

    await service.deleteShipmentTrackings(compensationInput.shipmentId);
  },
);
