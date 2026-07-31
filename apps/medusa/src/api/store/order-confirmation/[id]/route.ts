import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { Logger } from "@medusajs/framework/types";

import { loadOrderConfirmation } from "../../../../lib/order-confirmation";
import { verifyOrderAccessToken } from "../../../../lib/order-access-token";

export const ORDER_ACCESS_DENIED_LOG_TAG = "[order:access-denied]";

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
) {
  const logger = req.scope.resolve<Logger>(ContainerRegistrationKeys.LOGGER);

  const orderId = req.params.id ?? "";
  const rawToken = req.query.token;
  const token = typeof rawToken === "string" ? rawToken : null;

  // 404 rather than 403 throughout: a 403 confirms the order exists, which is
  // the very thing URL manipulation is fishing for.
  function deny(reason: string) {
    logger.warn(
      `${ORDER_ACCESS_DENIED_LOG_TAG} order=${orderId} reason=${reason}`,
    );
    return res.status(404).json({
      error: "order_not_found",
      message: "order_not_found",
    });
  }

  if (token) {
    const secret = process.env.ORDER_ACCESS_SECRET ?? "";
    const verified = verifyOrderAccessToken(token, secret, { orderId });
    if (!verified.valid) return deny(verified.reason);

    const loaded = await loadOrderConfirmation(req.scope, orderId);
    if (!loaded) return deny("missing");

    return res.json({ order: loaded.order });
  }

  const actorId = req.auth_context?.actor_id;
  if (!actorId) return deny("no_token_no_session");

  const loaded = await loadOrderConfirmation(req.scope, orderId);
  if (!loaded) return deny("missing");

  if (loaded.customerId !== actorId) return deny("customer_mismatch");

  return res.json({ order: loaded.order });
}
