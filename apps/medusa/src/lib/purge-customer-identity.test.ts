import type { MedusaContainer } from "@medusajs/framework/types";

import { purgeCustomerIdentity } from "./purge-customer-identity.js";

function makeThenableBuilder(resolveValue: unknown) {
  const builder: Record<string, unknown> = {
    where: jest.fn(() => builder),
    whereIn: jest.fn(() => builder),
    whereRaw: jest.fn(() => builder),
    whereNotExists: jest.fn(() => builder),
    select: jest.fn(() => builder),
    from: jest.fn(() => builder),
    del: jest.fn(() => builder),
    returning: jest.fn(() => Promise.resolve(resolveValue)),
    then: (resolve: (value: unknown) => void) => resolve(resolveValue),
  };
  return builder;
}

function makeTrx({
  existingCustomers = [{ id: "cus_1" }],
  deletedAddresses = [{ id: "caddr_1" }],
  deletedProviderIdentities = [{ id: "pi_1" }],
  deletedAuthIdentities = [{ id: "auid_1" }],
  deletedCustomers = [{ id: "cus_1" }],
}: {
  existingCustomers?: { id: string }[];
  deletedAddresses?: { id: string }[];
  deletedProviderIdentities?: { id: string }[];
  deletedAuthIdentities?: { id: string }[];
  deletedCustomers?: { id: string }[];
} = {}) {
  const selectCustomerBuilder = makeThenableBuilder(existingCustomers);
  const deleteAddressBuilder = makeThenableBuilder(deletedAddresses);
  const deleteProviderIdentityBuilder = makeThenableBuilder(
    deletedProviderIdentities,
  );
  const deleteAuthIdentityBuilder = makeThenableBuilder(deletedAuthIdentities);
  const deleteCustomerBuilder = makeThenableBuilder(deletedCustomers);

  const calls: string[] = [];

  const trx = jest.fn((table: string) => {
    calls.push(table);
    if (table === "customer") {
      return calls.filter((c) => c === "customer").length === 1
        ? selectCustomerBuilder
        : deleteCustomerBuilder;
    }
    if (table === "customer_address") return deleteAddressBuilder;
    if (table === "provider_identity") return deleteProviderIdentityBuilder;
    throw new Error(`Unexpected table: ${table}`);
  }) as unknown as {
    (table: string): unknown;
    from: jest.Mock;
    select: jest.Mock;
  };

  trx.from = jest.fn(() => deleteAuthIdentityBuilder);
  trx.select = jest.fn(() => makeThenableBuilder([]));

  return {
    trx,
    selectCustomerBuilder,
    deleteAddressBuilder,
    deleteProviderIdentityBuilder,
    deleteAuthIdentityBuilder,
    deleteCustomerBuilder,
  };
}

function makeContainer(trx: unknown) {
  const knex = {
    transaction: jest.fn((callback: (trx: unknown) => unknown) =>
      callback(trx),
    ),
  };
  return {
    resolve: jest.fn(() => knex),
  } as unknown as MedusaContainer;
}

describe("purgeCustomerIdentity", () => {
  it("deletes addresses, the auth0 provider identity, the orphaned auth identity, and the customer", async () => {
    const { trx } = makeTrx();
    const container = makeContainer(trx);

    const result = await purgeCustomerIdentity(container, "Cam@Example.com");

    expect(result).toEqual({
      deletedAddresses: 1,
      deletedProviderIdentities: 1,
      deletedAuthIdentities: 1,
      deletedCustomers: 1,
    });
  });

  it("lowercases the email before matching provider_identity.entity_id and customer.email", async () => {
    const { trx, selectCustomerBuilder, deleteProviderIdentityBuilder } =
      makeTrx();
    const container = makeContainer(trx);

    await purgeCustomerIdentity(container, "Cam@Example.com");

    expect(selectCustomerBuilder.where).toHaveBeenCalledWith({
      email: "cam@example.com",
    });
    expect(deleteProviderIdentityBuilder.where).toHaveBeenCalledWith({
      entity_id: "cam@example.com",
      provider: "auth0",
    });
  });

  it("skips the address delete entirely when there is no matching customer", async () => {
    const { trx, deleteAddressBuilder } = makeTrx({ existingCustomers: [] });
    const container = makeContainer(trx);

    const result = await purgeCustomerIdentity(container, "nobody@example.com");

    expect(result.deletedAddresses).toBe(0);
    expect(deleteAddressBuilder.del).not.toHaveBeenCalled();
  });

  it("never touches the order table — past orders are financial records, not identity data", async () => {
    const { trx } = makeTrx();
    const container = makeContainer(trx);

    await purgeCustomerIdentity(container, "cam@example.com");

    expect(trx).not.toHaveBeenCalledWith("order");
  });
});
