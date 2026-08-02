import {
  createWorkflow,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { markOrderFulfillmentAsDeliveredWorkflow } from "@medusajs/medusa/core-flows";
import type { OrderStatus } from "@craftynp/types";

import { applyTrackingStatusStep } from "./steps/apply-tracking-status";
import { transitionOrderStatusStep } from "./steps/transition-order-status";

export type ApplyTrackingEventWorkflowInput = {
  orderId: string;
  shipmentId: string;
  fulfillmentId: string | null;
  currentStatus: OrderStatus;
  statusCode: string;
  statusDescription: string | null;
  carrierStatusDescription: string | null;
};

const applyTrackingEventWorkflow = createWorkflow(
  "apply-tracking-event",
  function (input: ApplyTrackingEventWorkflowInput) {
    const applied = applyTrackingStatusStep(
      transform({ input }, ({ input }) => ({
        shipmentId: input.shipmentId,
        statusCode: input.statusCode,
        statusDescription: input.statusDescription,
        carrierStatusDescription: input.carrierStatusDescription,
      })),
    );

    when(
      { applied, input },
      ({ applied, input }) =>
        applied.status === "delivered" &&
        input.currentStatus === "shipped" &&
        Boolean(input.fulfillmentId),
    ).then(function () {
      markOrderFulfillmentAsDeliveredWorkflow.runAsStep({
        input: transform({ input }, ({ input }) => ({
          orderId: input.orderId,
          fulfillmentId: input.fulfillmentId as string,
        })),
      });

      transitionOrderStatusStep(
        transform({ input }, ({ input }) => ({
          orderId: input.orderId,
          to: "delivered" as const,
          reason: null,
          actorType: "webhook" as const,
          actorId: null,
        })),
      );
    });

    return new WorkflowResponse({ status: applied.status });
  },
);

export default applyTrackingEventWorkflow;
