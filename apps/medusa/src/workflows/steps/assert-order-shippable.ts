import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

import {
  toShipStationAddress,
  type OrderRow,
} from "../../lib/fulfilment-queue";
import { ORDER_STATUS_MODULE } from "../../modules/order-status";
import { OrderStatusTransitionError } from "../../modules/order-status/lib";
import type OrderStatusModuleService from "../../modules/order-status/service";
import type { ShipStationAddress } from "../../modules/shipstation/lib";

export type AssertOrderShippableOutput = {
  destination: ShipStationAddress;
  displayId: number;
};

export const assertOrderShippableStep = createStep(
  "assert-order-shippable",
  async (input: { orderId: string }, { container }) => {
    const service =
      container.resolve<OrderStatusModuleService>(ORDER_STATUS_MODULE);
    const query = container.resolve(ContainerRegistrationKeys.QUERY);

    const status = await service.currentStatus(input.orderId);
    if (status !== "packing") {
      throw new OrderStatusTransitionError(
        "invalid_transition",
        `This order is ${status ?? "not ready"}, so a label cannot be bought for it yet.`,
      );
    }

    const existing = await service.activeShipment(input.orderId);
    if (existing) {
      throw new OrderStatusTransitionError(
        "invalid_transition",
        "This order already has a label. Void it before buying another.",
      );
    }

    const { data } = await query.graph({
      entity: "order",
      fields: ["id", "display_id", "shipping_address.*"],
      filters: { id: input.orderId },
    });

    const order = (data as OrderRow[])[0];
    if (!order) {
      throw new OrderStatusTransitionError(
        "unknown_order",
        "We could not find this order.",
      );
    }

    const destination = toShipStationAddress(order.shipping_address);
    if (!destination) {
      throw new OrderStatusTransitionError(
        "invalid_transition",
        "This order has no complete delivery address, so no label can be bought.",
      );
    }

    return new StepResponse<AssertOrderShippableOutput>({
      destination,
      displayId: order.display_id ?? 0,
    });
  },
);
