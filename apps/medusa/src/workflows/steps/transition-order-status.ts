import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import type { OrderStatus, OrderStatusActor } from "@craftynp/types";

import { ORDER_STATUS_MODULE } from "../../modules/order-status";
import type OrderStatusModuleService from "../../modules/order-status/service";

export type TransitionOrderStatusStepInput = {
  orderId: string;
  to: OrderStatus;
  reason?: string | null;
  actorType: OrderStatusActor;
  actorId?: string | null;
};

type CompensationInput = {
  orderId: string;
  from: OrderStatus;
  historyEntryId: string;
};

export const transitionOrderStatusStep = createStep(
  "transition-order-status",
  async (input: TransitionOrderStatusStepInput, { container }) => {
    const service =
      container.resolve<OrderStatusModuleService>(ORDER_STATUS_MODULE);

    const result = await service.transition(input);

    return new StepResponse(result, {
      orderId: input.orderId,
      from: result.from,
      historyEntryId: result.historyEntryId,
    } satisfies CompensationInput);
  },
  async (compensationInput: CompensationInput | undefined, { container }) => {
    if (!compensationInput) return;

    const service =
      container.resolve<OrderStatusModuleService>(ORDER_STATUS_MODULE);

    await service.revertTransition({
      orderId: compensationInput.orderId,
      status: compensationInput.from,
      historyEntryId: compensationInput.historyEntryId,
    });
  },
);
