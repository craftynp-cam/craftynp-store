import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";

import { createReservationsWorkflow } from "@medusajs/medusa/core-flows";

import { restoreReservationsStep } from "./steps/restore-reservations";
import { transitionOrderStatusStep } from "./steps/transition-order-status";
import { voidShipStationLabelStep } from "./steps/void-shipstation-label";
import { voidShipmentTrackingStep } from "./steps/void-shipment-tracking";

export type VoidShipmentWorkflowInput = {
  orderId: string;
  reason?: string | null;
  actorId?: string | null;
};

const voidShipmentWorkflow = createWorkflow(
  "void-shipment",
  function (input: VoidShipmentWorkflowInput) {
    const voidResult = voidShipStationLabelStep(
      transform({ input }, ({ input }) => ({ orderId: input.orderId })),
    );

    const shipment = voidShipmentTrackingStep(
      transform({ input, voidResult }, ({ input, voidResult }) => ({
        orderId: input.orderId,
        approved: voidResult.approved,
        message: voidResult.message,
      })),
    );

    const reservations = restoreReservationsStep(
      transform({ input }, ({ input }) => ({ orderId: input.orderId })),
    );

    createReservationsWorkflow.runAsStep({
      input: transform({ reservations }, ({ reservations }) => ({
        reservations,
      })),
    });

    transitionOrderStatusStep(
      transform({ input, voidResult }, ({ input, voidResult }) => ({
        orderId: input.orderId,
        to: "packing" as const,
        reason:
          input.reason ??
          (voidResult.message
            ? `Shipping label voided — ${voidResult.message}`
            : "Shipping label voided"),
        actorType: "user" as const,
        actorId: input.actorId ?? null,
      })),
    );

    return new WorkflowResponse({
      shipmentId: shipment.id,
      voidApproved: voidResult.approved,
      voidMessage: voidResult.message,
    });
  },
);

export default voidShipmentWorkflow;
