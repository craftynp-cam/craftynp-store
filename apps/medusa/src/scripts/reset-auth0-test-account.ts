import type { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

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

  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION);

  const deletedProviderIdentities = await knex("provider_identity")
    .where({ entity_id: email, provider: "auth0" })
    .del()
    .returning("id");

  const deletedAuthIdentities = await knex
    .from("auth_identity as ai")
    .whereNotExists(
      knex
        .select(1)
        .from("provider_identity as pi")
        .whereRaw("pi.auth_identity_id = ai.id"),
    )
    .del()
    .returning("id");

  const deletedCustomers = await knex("customer")
    .where({ email })
    .del()
    .returning("id");

  logger.info(
    `Reset ${email}: removed ${deletedProviderIdentities.length} provider identity, ` +
      `${deletedAuthIdentities.length} orphaned auth identity, and ` +
      `${deletedCustomers.length} customer row(s).`,
  );
  logger.info(
    "This does not remove the user from Auth0 itself — delete it from the tenant's dashboard too for a fully clean slate.",
  );
}
