import type { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

export type PurgeCustomerIdentityResult = {
  deletedAddresses: number;
  deletedProviderIdentities: number;
  deletedAuthIdentities: number;
  deletedCustomers: number;
};

export async function purgeCustomerIdentity(
  container: MedusaContainer,
  email: string,
): Promise<PurgeCustomerIdentityResult> {
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const normalizedEmail = email.trim().toLowerCase();

  return knex.transaction(async (trx) => {
    const customers: { id: string }[] = await trx("customer")
      .where({ email: normalizedEmail })
      .select("id");
    const customerIds = customers.map((customer) => customer.id);

    const deletedAddresses = customerIds.length
      ? (
          await trx("customer_address")
            .whereIn("customer_id", customerIds)
            .del()
            .returning("id")
        ).length
      : 0;

    const deletedProviderIdentities = (
      await trx("provider_identity")
        .where({ entity_id: normalizedEmail, provider: "auth0" })
        .del()
        .returning("id")
    ).length;

    const deletedAuthIdentities = (
      await trx
        .from("auth_identity as ai")
        .whereNotExists(
          trx
            .select(1)
            .from("provider_identity as pi")
            .whereRaw("pi.auth_identity_id = ai.id"),
        )
        .del()
        .returning("id")
    ).length;

    const deletedCustomers = (
      await trx("customer")
        .where({ email: normalizedEmail })
        .del()
        .returning("id")
    ).length;

    return {
      deletedAddresses,
      deletedProviderIdentities,
      deletedAuthIdentities,
      deletedCustomers,
    };
  });
}
