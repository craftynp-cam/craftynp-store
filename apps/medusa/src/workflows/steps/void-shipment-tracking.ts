import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";

import { ORDER_STATUS_MODULE } from "../../modules/order-status";
import type OrderStatusModuleService from "../../modules/order-status/service";

export const voidShipmentTrackingStep = createStep(
  "void-shipment-tracking",
  async (
    input: {
      orderId: string;
      approved?: boolean | null;
      message?: string | null;
    },
    { container },
  ) => {
    const service =
      container.resolve<OrderStatusModuleService>(ORDER_STATUS_MODULE);

    const shipment = await service.voidShipment(input.orderId, {
      approved: input.approved ?? null,
      message: input.message ?? null,
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

    await service.updateShipmentTrackings({
      id: compensationInput.shipmentId,
      voided_at: null,
      void_approved: null,
      void_message: null,
    });
  },
);
