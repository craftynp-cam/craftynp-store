import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import {
  createOrderFulfillmentWorkflow,
  createOrderShipmentWorkflow,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows";
import { carrierTrackingUrl } from "@craftynp/types";

import { recordShipmentTrackingStep } from "./steps/record-shipment-tracking";
import { transitionOrderStatusStep } from "./steps/transition-order-status";

export type RecordShipmentWorkflowInput = {
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
  actorId?: string | null;
};

const recordShipmentWorkflow = createWorkflow(
  "record-shipment",
  function (input: RecordShipmentWorkflowInput) {
    const { data: order } = useQueryGraphStep({
      entity: "order",
      fields: ["id", "items.*"],
      filters: { id: input.orderId },
      options: { throwIfKeyNotFound: true, isList: false },
    });

    const items = transform({ order }, ({ order }) =>
      (
        (order as { items?: { id: string; quantity: number }[] }).items ?? []
      ).map((item) => ({ id: item.id, quantity: item.quantity })),
    );

    const fulfillment = createOrderFulfillmentWorkflow.runAsStep({
      input: transform({ input, items }, ({ input, items }) => ({
        order_id: input.orderId,
        items,
      })),
    });

    createOrderShipmentWorkflow.runAsStep({
      input: transform(
        { input, items, fulfillment },
        ({ input, items, fulfillment }) => ({
          order_id: input.orderId,
          fulfillment_id: fulfillment.id,
          items,
          labels: [
            {
              tracking_number: input.trackingNumber,
              tracking_url:
                carrierTrackingUrl(input.carrierCode, input.trackingNumber) ??
                "",
              label_url: input.labelUrl ?? "",
            },
          ],
        }),
      ),
    });

    recordShipmentTrackingStep(
      transform({ input, fulfillment }, ({ input, fulfillment }) => ({
        orderId: input.orderId,
        trackingNumber: input.trackingNumber,
        carrierCode: input.carrierCode,
        carrierId: input.carrierId ?? null,
        serviceCode: input.serviceCode ?? null,
        labelId: input.labelId ?? null,
        labelUrl: input.labelUrl ?? null,
        labelFileId: input.labelFileId ?? null,
        shipmentCost: input.shipmentCost ?? null,
        currencyCode: input.currencyCode ?? null,
        fulfillmentId: fulfillment.id,
      })),
    );

    transitionOrderStatusStep(
      transform({ input }, ({ input }) => ({
        orderId: input.orderId,
        to: "shipped" as const,
        reason: null,
        actorType: "user" as const,
        actorId: input.actorId ?? null,
      })),
    );

    return new WorkflowResponse({ fulfillmentId: fulfillment.id });
  },
);

export default recordShipmentWorkflow;
