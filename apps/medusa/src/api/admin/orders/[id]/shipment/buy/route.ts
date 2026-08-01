import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { Logger } from "@medusajs/framework/types";
import type { BuyLabelRequest } from "@craftynp/types";

import { describeInternalFailure, describeLabelFailure } from "@craftynp/types";

import { describeError } from "../../../../../../lib/describe-error";
import { loadOrderStatusDetail } from "../../../../../../lib/order-status-detail";
import { OrderStatusTransitionError } from "../../../../../../modules/order-status/lib";
import {
  SHIPSTATION_LABEL_LOG_TAG,
  ShipStationLabelError,
} from "../../../../../../modules/shipstation/lib";
import buyShippingLabelWorkflow from "../../../../../../workflows/buy-shipping-label";

export async function POST(
  req: AuthenticatedMedusaRequest<BuyLabelRequest>,
  res: MedusaResponse,
) {
  const logger = req.scope.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const orderId = req.params.id ?? "";
  const body = req.validatedBody;

  try {
    const { result } = await buyShippingLabelWorkflow(req.scope).run({
      input: {
        orderId,
        carrierId: body.carrierId,
        serviceCode: body.serviceCode,
        parcel: body.parcel,
        actorId: req.auth_context?.actor_id ?? null,
      },
    });

    return res.json({
      orderStatus: await loadOrderStatusDetail(req.scope, orderId),
      label: result,
    });
  } catch (error) {
    const detail = describeError(error);

    if (error instanceof OrderStatusTransitionError) {
      logger.warn(
        `${SHIPSTATION_LABEL_LOG_TAG} reason=buy_label_rejected order=${orderId} detail=${error.reason}`,
      );

      return res.status(409).json({
        error: "buy_label_rejected",
        reason: error.reason,
        message: detail,
      });
    }

    if (!(error instanceof ShipStationLabelError)) {
      const copy = describeInternalFailure(detail);

      return res.status(500).json({
        error: "buy_label_failed",
        reason: "internal_error",
        message: `${copy.title}. ${copy.body} ${copy.nextStep}`,
      });
    }

    const reason = error.reason;
    const carrierMessage = error.carrierMessage;

    logger.error(
      `${SHIPSTATION_LABEL_LOG_TAG} reason=buy_label_failed order=${orderId} detail=${reason} carrier_message=${carrierMessage ?? ""} error=${detail}`,
    );

    const copy = describeLabelFailure(reason, carrierMessage);

    return res.status(502).json({
      error: "buy_label_failed",
      reason,
      carrierMessage,
      message: `${copy.title}. ${copy.body} ${copy.nextStep}`,
    });
  }
}
