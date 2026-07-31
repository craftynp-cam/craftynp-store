import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import type { Logger } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

import { describeError } from "../../../../lib/describe-error";
import { purgeCustomerIdentity } from "../../../../lib/purge-customer-identity";

export async function DELETE(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
) {
  const logger = req.scope.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const { data: customers } = await query.graph({
    entity: "customer",
    fields: ["id", "email"],
    filters: { id: req.auth_context.actor_id },
  });
  const customer = customers[0] as { id: string; email: string } | undefined;

  if (!customer) {
    return res
      .status(404)
      .json({ error: "customer_not_found", message: "customer_not_found" });
  }

  try {
    await purgeCustomerIdentity(req.scope, customer.email);
  } catch (error) {
    logger.error(
      `[account:close-failed] customer=${customer.id} ${describeError(error)}`,
    );
    return res.status(502).json({
      error: "close_account_failed",
      message: `close_account_failed:${describeError(error)}`,
    });
  }

  return res.json({ ok: true });
}
