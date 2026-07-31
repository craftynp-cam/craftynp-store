import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { Logger } from "@medusajs/framework/types";
import { completeCartWorkflow } from "@medusajs/medusa/core-flows";
import type { CheckoutCompleteRequest } from "@craftynp/types";

export async function POST(
  req: MedusaRequest<CheckoutCompleteRequest>,
  res: MedusaResponse,
) {
  const logger = req.scope.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const { cartId } = req.validatedBody;

  // Idempotent on cartId (AC10): a cart that already produced an order
  // returns that order rather than erroring, so a double-submit or a retried
  // request after a dropped response cannot create a second order or charge.
  const { data: existingOrders } = await query.graph({
    entity: "order",
    fields: ["id", "display_id"],
    filters: { cart_id: cartId },
  });
  const existingOrder = existingOrders[0] as
    | { id: string; display_id: number }
    | undefined;

  if (existingOrder) {
    return res.json({
      orderId: existingOrder.id,
      displayId: existingOrder.display_id,
    });
  }

  let orderId: string;
  try {
    const { result } = await completeCartWorkflow(req.scope).run({
      input: { id: cartId },
    });
    orderId = (result as { id: string }).id;
  } catch (error) {
    logger.error(
      `[checkout:complete-failed] cart=${cartId} error=${error instanceof Error ? error.message : String(error)}`,
    );
    return res
      .status(502)
      .json({ error: "order_placement_unavailable" });
  }

  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["id", "display_id"],
    filters: { id: orderId },
  });
  const order = orders[0] as { id: string; display_id: number };

  return res.json({ orderId: order.id, displayId: order.display_id });
}
