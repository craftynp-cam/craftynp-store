import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { Logger } from "@medusajs/framework/types";
import type { VoidShipmentRequest } from "@craftynp/types";

import { describeError } from "../../../../../../lib/describe-error";
import { loadOrderStatusDetail } from "../../../../../../lib/order-status-detail";
import { ORDER_STATUS_LOG_TAG } from "../../../../../../modules/order-status/lib";
import voidShipmentWorkflow from "../../../../../../workflows/void-shipment";

export async function POST(
  req: AuthenticatedMedusaRequest<VoidShipmentRequest>,
  res: MedusaResponse,
) {
  const logger = req.scope.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const orderId = req.params.id ?? "";

  try {
    await voidShipmentWorkflow(req.scope).run({
      input: {
        orderId,
        reason: req.validatedBody?.reason ?? null,
        actorId: req.auth_context?.actor_id ?? null,
      },
    });
  } catch (error) {
    const detail = describeError(error);
    logger.warn(
      `${ORDER_STATUS_LOG_TAG} reason=void_shipment_failed order=${orderId} error=${detail}`,
    );

    return res.status(409).json({
      error: "void_shipment_failed",
      reason: "void_shipment_failed",
      message: detail,
    });
  }

  return res.json({
    orderStatus: await loadOrderStatusDetail(req.scope, orderId),
  });
}
