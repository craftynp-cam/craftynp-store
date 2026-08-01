import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { Logger } from "@medusajs/framework/types";

import { ORDER_STATUS_MODULE } from "../../modules/order-status";
import { OrderStatusTransitionError } from "../../modules/order-status/lib";
import type OrderStatusModuleService from "../../modules/order-status/service";
import { SHIPSTATION_MODULE } from "../../modules/shipstation";
import { SHIPSTATION_VOID_LOG_TAG } from "../../modules/shipstation/lib";
import type ShipStationModuleService from "../../modules/shipstation/service";

export type VoidShipStationLabelStepOutput = {
  approved: boolean | null;
  message: string | null;
};

export const voidShipStationLabelStep = createStep(
  "void-shipstation-label",
  async (input: { orderId: string }, { container }) => {
    const service =
      container.resolve<OrderStatusModuleService>(ORDER_STATUS_MODULE);
    const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);

    const shipment = await service.activeShipment(input.orderId);
    if (!shipment) {
      throw new OrderStatusTransitionError(
        "no_shipment",
        "This order has no shipment to void.",
      );
    }

    if (!shipment.label_id) {
      return new StepResponse<VoidShipStationLabelStepOutput>({
        approved: null,
        message: null,
      });
    }

    const shipstation =
      container.resolve<ShipStationModuleService>(SHIPSTATION_MODULE);

    const result = await shipstation.voidLabel(shipment.label_id);

    logger.warn(
      `${SHIPSTATION_VOID_LOG_TAG} order=${input.orderId} label=${shipment.label_id} approved=${result.approved}`,
    );

    return new StepResponse<VoidShipStationLabelStepOutput>(result);
  },
);
