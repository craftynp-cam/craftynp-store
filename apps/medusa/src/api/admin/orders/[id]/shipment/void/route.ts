import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { Logger } from "@medusajs/framework/types";
import type { VoidShipmentRequest } from "@craftynp/types";

import { describeLabelFailure } from "@craftynp/types";

import { describeError } from "../../../../../../lib/describe-error";
import { loadOrderStatusDetail } from "../../../../../../lib/order-status-detail";
import {
  ORDER_STATUS_LOG_TAG,
  OrderStatusTransitionError,
} from "../../../../../../modules/order-status/lib";
import { ShipStationLabelError } from "../../../../../../modules/shipstation/lib";
import voidShipmentWorkflow from "../../../../../../workflows/void-shipment";

export async function POST(
  req: AuthenticatedMedusaRequest<VoidShipmentRequest>,
  res: MedusaResponse,
) {
  const logger = req.scope.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const orderId = req.params.id ?? "";

  let voidApproved: boolean | null;
  let voidMessage: string | null;

  try {
    const { result } = await voidShipmentWorkflow(req.scope).run({
      input: {
        orderId,
        reason: req.validatedBody?.reason ?? null,
        actorId: req.auth_context?.actor_id ?? null,
      },
    });

    voidApproved = result.voidApproved;
    voidMessage = result.voidMessage;
  } catch (error) {
    const detail = describeError(error);
    logger.warn(
      `${ORDER_STATUS_LOG_TAG} reason=void_shipment_failed order=${orderId} error=${detail}`,
    );

    if (error instanceof ShipStationLabelError) {
      const copy = describeLabelFailure(error.reason, error.carrierMessage);

      return res.status(502).json({
        error: "void_shipment_failed",
        reason: error.reason,
        message: `We could not reach the carrier to void this label, so nothing has changed. ${copy.nextStep}`,
      });
    }

    return res.status(409).json({
      error: "void_shipment_failed",
      reason:
        error instanceof OrderStatusTransitionError
          ? error.reason
          : "void_shipment_failed",
      message: detail,
    });
  }

  return res.json({
    orderStatus: await loadOrderStatusDetail(req.scope, orderId),
    voidApproved,
    voidMessage,
  });
}
