import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { Logger } from "@medusajs/framework/types";
import type { RecordShipmentRequest } from "@craftynp/types";

import { describeError } from "../../../../../lib/describe-error";
import { loadOrderStatusDetail } from "../../../../../lib/order-status-detail";
import { ORDER_STATUS_LOG_TAG } from "../../../../../modules/order-status/lib";
import recordShipmentWorkflow from "../../../../../workflows/record-shipment";

export async function POST(
  req: AuthenticatedMedusaRequest<RecordShipmentRequest>,
  res: MedusaResponse,
) {
  const logger = req.scope.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const orderId = req.params.id ?? "";
  const body = req.validatedBody;

  try {
    await recordShipmentWorkflow(req.scope).run({
      input: {
        orderId,
        trackingNumber: body.trackingNumber,
        carrierCode: body.carrierCode,
        serviceCode: body.serviceCode ?? null,
        labelId: body.labelId ?? null,
        labelUrl: body.labelUrl ?? null,
        actorId: req.auth_context?.actor_id ?? null,
      },
    });
  } catch (error) {
    const detail = describeError(error);
    logger.error(
      `${ORDER_STATUS_LOG_TAG} reason=record_shipment_failed order=${orderId} error=${detail}`,
    );

    return res.status(409).json({
      error: "record_shipment_failed",
      reason: "record_shipment_failed",
      message: detail,
    });
  }

  return res.json({
    orderStatus: await loadOrderStatusDetail(req.scope, orderId),
  });
}
