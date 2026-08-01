import type {
  AuthenticatedMedusaRequest,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { Logger } from "@medusajs/framework/types";
import type { OrderStatusUpdateRequest } from "@craftynp/types";

import { describeError } from "../../../../../lib/describe-error";
import { loadOrderStatusDetail } from "../../../../../lib/order-status-detail";
import { ORDER_STATUS_LOG_TAG } from "../../../../../modules/order-status/lib";
import transitionOrderStatusWorkflow from "../../../../../workflows/transition-order-status";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const orderId = req.params.id ?? "";

  return res.json({
    orderStatus: await loadOrderStatusDetail(req.scope, orderId),
  });
}

export async function POST(
  req: AuthenticatedMedusaRequest<OrderStatusUpdateRequest>,
  res: MedusaResponse,
) {
  const logger = req.scope.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const orderId = req.params.id ?? "";
  const { status, reason } = req.validatedBody;

  try {
    await transitionOrderStatusWorkflow(req.scope).run({
      input: {
        orderId,
        to: status,
        reason: reason ?? null,
        actorType: "user",
        actorId: req.auth_context?.actor_id ?? null,
      },
    });
  } catch (error) {
    const detail = describeError(error);
    logger.warn(
      `${ORDER_STATUS_LOG_TAG} reason=transition_rejected order=${orderId} to=${status} error=${detail}`,
    );

    return res.status(409).json({
      error: "invalid_transition",
      reason: "invalid_transition",
      message: detail,
    });
  }

  return res.json({
    orderStatus: await loadOrderStatusDetail(req.scope, orderId),
  });
}
