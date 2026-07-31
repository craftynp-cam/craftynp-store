import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { Logger } from "@medusajs/framework/types";
import { completeCartWorkflow } from "@medusajs/medusa/core-flows";
import type { CheckoutCompleteRequest } from "@craftynp/types";

type OrderSummary = { id: string; display_id: number };

export async function POST(
  req: MedusaRequest<CheckoutCompleteRequest>,
  res: MedusaResponse,
) {
  const logger = req.scope.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const { cartId } = req.validatedBody;

  // `Order` carries no `cart_id` column — the cart/order association lives in
  // the `order_cart` link table (@medusajs/link-modules), so this has to be
  // queried through the link entity rather than filtered on the order itself.
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

  // Idempotent on cartId (AC10): a cart that already produced an order
  // returns that order rather than erroring, so a double-submit or a retried
  // request after a dropped response cannot create a second order or charge.
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
    // AC9's webhook path races this one: Stripe's `payment_intent.succeeded`
    // drives `processPaymentWorkflow` → `completeCartAfterPaymentStep`, which
    // can place the order between the lookup above and this call, leaving
    // `completeCartWorkflow` to throw on an already-completed cart. That is a
    // success, not a failure, so re-check the link before reporting one.
    const racedOrder = await findOrderForCart();
    if (racedOrder) {
      return res.json({
        orderId: racedOrder.id,
        displayId: racedOrder.display_id,
      });
    }

    logger.error(
      `[checkout:complete-failed] cart=${cartId} error=${error instanceof Error ? error.message : String(error)}`,
    );
    return res.status(502).json({ error: "order_placement_unavailable" });
  }
}
