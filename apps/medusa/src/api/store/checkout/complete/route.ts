import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { Logger } from "@medusajs/framework/types";
import { completeCartWorkflow } from "@medusajs/medusa/core-flows";
import type { CheckoutCompleteRequest } from "@craftynp/types";

import { describeError } from "../../../../lib/describe-error";

type OrderSummary = { id: string; display_id: number };

export async function POST(
  req: MedusaRequest<CheckoutCompleteRequest>,
  res: MedusaResponse,
) {
  const logger = req.scope.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const { cartId } = req.validatedBody;

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
    return res.json({
      orderId: existingOrder.id,
      displayId: existingOrder.display_id,
    });
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

    return res.json({ orderId: order.id, displayId: order.display_id });
  } catch (error) {
    const racedOrder = await findOrderForCart();
    if (racedOrder) {
      return res.json({
        orderId: racedOrder.id,
        displayId: racedOrder.display_id,
      });
    }

    const detail = describeError(error);
    logger.error(`[checkout:complete-failed] cart=${cartId} error=${detail}`);
    return res.status(502).json({
      error: "order_placement_unavailable",
      message: `order_placement_unavailable:${detail}`,
    });
  }
}
