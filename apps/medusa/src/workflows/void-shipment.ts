import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";

import { transitionOrderStatusStep } from "./steps/transition-order-status";
import { voidShipmentTrackingStep } from "./steps/void-shipment-tracking";

export type VoidShipmentWorkflowInput = {
  orderId: string;
  reason?: string | null;
  actorId?: string | null;
};

const voidShipmentWorkflow = createWorkflow(
  "void-shipment",
  function (input: VoidShipmentWorkflowInput) {
    const shipment = voidShipmentTrackingStep(
      transform({ input }, ({ input }) => ({ orderId: input.orderId })),
    );

    transitionOrderStatusStep(
      transform({ input }, ({ input }) => ({
        orderId: input.orderId,
        to: "packing" as const,
        reason: input.reason ?? "Shipping label voided",
        actorType: "user" as const,
        actorId: input.actorId ?? null,
      })),
    );

    return new WorkflowResponse({ shipmentId: shipment.id });
  },
);

export default voidShipmentWorkflow;
