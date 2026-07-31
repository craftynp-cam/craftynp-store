import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

const mockPurgeCustomerIdentity = jest.fn();

jest.mock("../../../../lib/purge-customer-identity", () => ({
  purgeCustomerIdentity: (
    ...args: Parameters<typeof mockPurgeCustomerIdentity>
  ) => mockPurgeCustomerIdentity(...args),
}));

import { DELETE } from "./route";

const CUSTOMER = { id: "cus_01", email: "cam@example.com" };

type Harness = {
  req: AuthenticatedMedusaRequest;
  res: MedusaResponse;
  json: jest.Mock;
  status: jest.Mock;
  logger: { error: jest.Mock };
  graph: jest.Mock;
};

function buildHarness(customer: typeof CUSTOMER | null): Harness {
  const graph = jest.fn(async () => ({ data: customer ? [customer] : [] }));
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const logger = { error: jest.fn() };

  return {
    req: {
      auth_context: { actor_id: CUSTOMER.id },
      scope: {
        resolve: (key: string) =>
          key === ContainerRegistrationKeys.QUERY ? { graph } : logger,
      },
    } as unknown as AuthenticatedMedusaRequest,
    res: { json, status } as unknown as MedusaResponse,
    json,
    status,
    logger,
    graph,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("DELETE /store/customers/me", () => {
  it("purges the signed-in customer's own identity and confirms", async () => {
    const { req, res, json } = buildHarness(CUSTOMER);
    mockPurgeCustomerIdentity.mockResolvedValue({
      deletedAddresses: 1,
      deletedProviderIdentities: 1,
      deletedAuthIdentities: 1,
      deletedCustomers: 1,
    });

    await DELETE(req, res);

    expect(mockPurgeCustomerIdentity).toHaveBeenCalledWith(
      req.scope,
      CUSTOMER.email,
    );
    expect(json).toHaveBeenCalledWith({ ok: true });
  });

  it("takes the identity from auth_context, never from the request body", async () => {
    const { req, res, graph } = buildHarness(CUSTOMER);

    await DELETE(req, res);

    expect(graph).toHaveBeenCalledWith(
      expect.objectContaining({ filters: { id: CUSTOMER.id } }),
    );
  });

  it("404s when the authenticated actor has no matching customer", async () => {
    const { req, res, status, json } = buildHarness(null);

    await DELETE(req, res);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      error: "customer_not_found",
      message: "customer_not_found",
    });
    expect(mockPurgeCustomerIdentity).not.toHaveBeenCalled();
  });

  it("reports a 502 and logs when the purge fails", async () => {
    const { req, res, status, json, logger } = buildHarness(CUSTOMER);
    mockPurgeCustomerIdentity.mockRejectedValue(new Error("db unreachable"));

    await DELETE(req, res);

    expect(status).toHaveBeenCalledWith(502);
    expect(json).toHaveBeenCalledWith({
      error: "close_account_failed",
      message: "close_account_failed:db unreachable",
    });
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("[account:close-failed]"),
    );
  });
});
