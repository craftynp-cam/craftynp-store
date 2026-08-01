import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";

import type { Parcel } from "../modules/shipstation/lib";
import recordShipmentWorkflow from "./record-shipment";
import { assertOrderShippableStep } from "./steps/assert-order-shippable";
import { purchaseShipStationLabelStep } from "./steps/purchase-shipstation-label";
import { storeLabelPdfStep } from "./steps/store-label-pdf";

export type BuyShippingLabelWorkflowInput = {
  orderId: string;
  carrierId: string;
  serviceCode: string;
  parcel: Parcel;
  actorId?: string | null;
};

const buyShippingLabelWorkflow = createWorkflow(
  "buy-shipping-label",
  function (input: BuyShippingLabelWorkflowInput) {
    const order = assertOrderShippableStep(
      transform({ input }, ({ input }) => ({ orderId: input.orderId })),
    );

    const label = purchaseShipStationLabelStep(
      transform({ input, order }, ({ input, order }) => ({
        orderId: input.orderId,
        destination: order.destination,
        parcel: input.parcel,
        carrierId: input.carrierId,
        serviceCode: input.serviceCode,
      })),
    );

    const stored = storeLabelPdfStep(
      transform({ input, order, label }, ({ input, order, label }) => ({
        orderId: input.orderId,
        displayId: order.displayId,
        labelId: label.labelId,
        pdfUrl: label.pdfUrl,
      })),
    );

    const shipment = recordShipmentWorkflow.runAsStep({
      input: transform(
        { input, label, stored },
        ({ input, label, stored }) => ({
          orderId: input.orderId,
          trackingNumber: label.trackingNumber,
          carrierCode: label.carrierCode,
          carrierId: label.carrierId,
          serviceCode: label.serviceCode,
          labelId: label.labelId,
          labelUrl: stored.labelUrl,
          labelFileId: stored.labelFileId,
          shipmentCost: label.shipmentCost,
          currencyCode: label.currencyCode,
          actorId: input.actorId ?? null,
        }),
      ),
    });

    return new WorkflowResponse(
      transform({ label, stored, shipment }, ({ label, stored, shipment }) => ({
        fulfillmentId: shipment.fulfillmentId,
        labelId: label.labelId,
        trackingNumber: label.trackingNumber,
        carrierCode: label.carrierCode,
        serviceCode: label.serviceCode,
        shipmentCost: label.shipmentCost,
        currencyCode: label.currencyCode,
        labelUrl: stored.labelUrl,
        labelStored: stored.stored,
      })),
    );
  },
);

export default buyShippingLabelWorkflow;
