import type { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

import { purgeCustomerIdentity } from "../lib/purge-customer-identity";

export default async function resetAuth0TestAccount({
  container,
  args,
}: ExecArgs) {
  const email = args
    .find((arg) => arg !== "--")
    ?.trim()
    .toLowerCase();
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

  if (!email) {
    logger.error(
      "Usage: medusa exec ./src/scripts/reset-auth0-test-account.ts <email>",
    );
    return;
  }

  const result = await purgeCustomerIdentity(container, email);

  logger.info(
    `Reset ${email}: removed ${result.deletedAddresses} address(es), ` +
      `${result.deletedProviderIdentities} provider identity, ` +
      `${result.deletedAuthIdentities} orphaned auth identity, and ` +
      `${result.deletedCustomers} customer row(s).`,
  );
  logger.info(
    "This does not remove the user from Auth0 itself — delete it from the tenant's dashboard too for a fully clean slate.",
  );
}
