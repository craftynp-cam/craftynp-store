import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";

import { ORDER_STATUS_MODULE } from "../../modules/order-status";
import type OrderStatusModuleService from "../../modules/order-status/service";

export const voidShipmentTrackingStep = createStep(
  "void-shipment-tracking",
  async (input: { orderId: string }, { container }) => {
    const service =
      container.resolve<OrderStatusModuleService>(ORDER_STATUS_MODULE);

    const shipment = await service.voidShipment(input.orderId);

    return new StepResponse(shipment, { shipmentId: shipment.id });
  },
  async (
    compensationInput: { shipmentId: string } | undefined,
    { container },
  ) => {
    if (!compensationInput) return;

    const service =
      container.resolve<OrderStatusModuleService>(ORDER_STATUS_MODULE);

    await service.updateShipmentTrackings({
      id: compensationInput.shipmentId,
      voided_at: null,
    });
  },
);
