import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { Logger } from "@medusajs/framework/types";

import { ORDER_STATUS_MODULE } from "../../modules/order-status";
import type OrderStatusModuleService from "../../modules/order-status/service";
import { SHIPSTATION_MODULE } from "../../modules/shipstation";
import {
  SHIPSTATION_LABEL_LOG_TAG,
  ShipStationLabelError,
  type Parcel,
  type PurchasedLabel,
  type ShipStationAddress,
} from "../../modules/shipstation/lib";
import type ShipStationModuleService from "../../modules/shipstation/service";

export type PurchaseShipStationLabelStepInput = {
  orderId: string;
  destination: ShipStationAddress;
  parcel: Parcel;
  carrierId: string;
  serviceCode: string;
};

const RECONCILE_LOOKBACK_MS = 60_000;

export const purchaseShipStationLabelStep = createStep(
  "purchase-shipstation-label",
  async (input: PurchaseShipStationLabelStepInput, { container }) => {
    const shipstation =
      container.resolve<ShipStationModuleService>(SHIPSTATION_MODULE);
    const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);

    const startedAt = Date.now();

    let label: PurchasedLabel;
    try {
      label = await shipstation.purchaseLabel({
        destination: input.destination,
        parcel: input.parcel,
        carrierId: input.carrierId,
        serviceCode: input.serviceCode,
        externalShipmentId: input.orderId,
      });
    } catch (error) {
      if (
        !(error instanceof ShipStationLabelError) ||
        error.reason !== "timeout_unconfirmed"
      ) {
        throw error;
      }

      const recovered = await shipstation.reconcileLabel({
        externalShipmentId: input.orderId,
        shipToName: input.destination.name,
        shipToPostalCode: input.destination.postalCode,
        serviceCode: input.serviceCode,
        sinceMs: startedAt - RECONCILE_LOOKBACK_MS,
      });

      if (!recovered) throw error;

      logger.warn(
        `${SHIPSTATION_LABEL_LOG_TAG} reason=recovered_after_timeout order=${input.orderId} label=${recovered.labelId}`,
      );
      label = recovered;
    }

    return new StepResponse(label, {
      labelId: label.labelId,
      trackingNumber: label.trackingNumber,
      orderId: input.orderId,
    });
  },
  async (
    compensationInput:
      { labelId: string; trackingNumber: string; orderId: string } | undefined,
    { container },
  ) => {
    if (!compensationInput) return;

    const { labelId, trackingNumber, orderId } = compensationInput;
    const shipstation =
      container.resolve<ShipStationModuleService>(SHIPSTATION_MODULE);
    const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);

    let approved = false;
    let carrierMessage: string;

    try {
      const result = await shipstation.voidLabel(labelId);
      approved = result.approved;
      carrierMessage = result.message;
    } catch (error) {
      carrierMessage = error instanceof Error ? error.message : String(error);
    }

    if (approved) {
      logger.warn(
        `${SHIPSTATION_LABEL_LOG_TAG} reason=compensating_void_ok order=${orderId} label=${labelId}`,
      );
      return;
    }

    logger.error(
      `${SHIPSTATION_LABEL_LOG_TAG} reason=orphaned_label order=${orderId} label=${labelId} tracking=${trackingNumber} carrier_message=${carrierMessage}`,
    );

    try {
      const service =
        container.resolve<OrderStatusModuleService>(ORDER_STATUS_MODULE);
      const record = await service.ensureRecord(orderId);

      await service.createOrderStatusHistoryEntries({
        order_status_id: record.id,
        from_status: null,
        to_status: record.status,
        reason: `A label was bought for this order but could not be recorded, and the carrier would not void it. Tracking ${trackingNumber} may still be live — void it in ShipStation before shipping this order again.`,
        actor_type: "system",
        actor_id: null,
      });
    } catch (error) {
      logger.error(
        `${SHIPSTATION_LABEL_LOG_TAG} reason=orphaned_label_unrecorded order=${orderId} label=${labelId} error=${error instanceof Error ? error.message : String(error)}`,
      );
    }
  },
);
