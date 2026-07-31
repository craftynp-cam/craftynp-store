import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { Logger } from "@medusajs/framework/types";
import { completeCartWorkflow } from "@medusajs/medusa/core-flows";
import type { CheckoutCompleteRequest } from "@craftynp/types";

import { describeError } from "../../../../lib/describe-error";
import {
  orderAccessTtlMs,
  signOrderAccessToken,
} from "../../../../lib/order-access-token";

type OrderSummary = { id: string; display_id: number };

export async function POST(
  req: MedusaRequest<CheckoutCompleteRequest>,
  res: MedusaResponse,
) {
  const logger = req.scope.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const { cartId } = req.validatedBody;

  function respondWithOrder(order: OrderSummary) {
    const secret = process.env.ORDER_ACCESS_SECRET ?? "";
    const ttlDays = Number(process.env.ORDER_ACCESS_TOKEN_TTL_DAYS);
    const orderToken = signOrderAccessToken(
      { oid: order.id, exp: Date.now() + orderAccessTtlMs(ttlDays) },
      secret,
    );

    return res.json({
      orderId: order.id,
      displayId: order.display_id,
      orderToken,
    });
  }

  async function findOrderForCart(): Promise<OrderSummary | null> {
    const { data: links } = await query.graph({
      entity: "order_cart",
      fields: ["order_id", "order.id", "order.display_id"],
      filters: { cart_id: cartId },
    });
    return (
      (links[0] as { order?: OrderSummary | null } | undefined)?.order ?? null
    );
  }

  const existingOrder = await findOrderForCart();
  if (existingOrder) {
    return respondWithOrder(existingOrder);
  }

  try {
    const { result } = await completeCartWorkflow(req.scope).run({
      input: { id: cartId },
    });
    const orderId = (result as { id: string }).id;

    const { data: orders } = await query.graph({
      entity: "order",
      fields: ["id", "display_id"],
      filters: { id: orderId },
    });
    const order = orders[0] as OrderSummary;

    return respondWithOrder(order);
  } catch (error) {
    const racedOrder = await findOrderForCart();
    if (racedOrder) {
      return respondWithOrder(racedOrder);
    }

    const detail = describeError(error);
    logger.error(`[checkout:complete-failed] cart=${cartId} error=${detail}`);
    return res.status(502).json({
      error: "order_placement_unavailable",
      message: `order_placement_unavailable:${detail}`,
    });
  }
}
