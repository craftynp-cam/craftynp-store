import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

import { GET } from "./route";
import { signOrderAccessToken } from "../../../../lib/order-access-token";

const ORDER_ACCESS_SECRET = "test-order-access-secret";
const ORDER_ID = "order_01";
const CUSTOMER_ID = "cus_owner";

const ORDER_ROW = {
  id: ORDER_ID,
  display_id: 42,
  email: "jamie@example.com",
  created_at: "2026-07-30T12:00:00.000Z",
  status: "pending",
  currency_code: "usd",
  customer_id: CUSTOMER_ID,
  item_subtotal: 55.5,
  shipping_subtotal: 6,
  tax_total: 4.44,
  total: 65.94,
  items: [],
  shipping_address: null,
  shipping_methods: [],
};

function issueToken(orderId = ORDER_ID) {
  return signOrderAccessToken(
    { oid: orderId, exp: Date.now() + 60_000 },
    ORDER_ACCESS_SECRET,
  );
}

type Harness = {
  req: AuthenticatedMedusaRequest;
  res: MedusaResponse;
  json: jest.Mock;
  status: jest.Mock;
};

function buildHarness(options: {
  token?: string;
  actorId?: string;
  orderExists?: boolean;
}): Harness {
  const graph = jest.fn(async () => ({
    data: options.orderExists === false ? [] : [ORDER_ROW],
  }));

  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const logger = { warn: jest.fn(), error: jest.fn() };
  const orderStatus = {
    currentStatus: jest.fn(async () => "received"),
    activeShipment: jest.fn(async () => null),
  };

  return {
    req: {
      params: { id: ORDER_ID },
      query: options.token ? { token: options.token } : {},
      auth_context: options.actorId ? { actor_id: options.actorId } : undefined,
      scope: {
        resolve: (key: string) => {
          if (key === ContainerRegistrationKeys.QUERY) return { graph };
          if (key === "orderStatus") return orderStatus;
          return logger;
        },
      },
    } as unknown as AuthenticatedMedusaRequest,
    res: { json, status } as unknown as MedusaResponse,
    json,
    status,
  };
}

function expectNotFound(harness: Harness) {
  expect(harness.status).toHaveBeenCalledWith(404);
  expect(harness.json).toHaveBeenCalledWith({
    error: "order_not_found",
    message: "order_not_found",
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.ORDER_ACCESS_SECRET = ORDER_ACCESS_SECRET;
});

describe("GET /store/order-confirmation/:id", () => {
  it("returns the order for a valid guest token", async () => {
    const harness = buildHarness({ token: issueToken() });

    await GET(harness.req, harness.res);

    expect(harness.status).not.toHaveBeenCalled();
    expect(harness.json).toHaveBeenCalledWith({
      order: expect.objectContaining({ orderId: ORDER_ID, displayId: 42 }),
    });
  });

  it("returns the order for the customer who placed it", async () => {
    const harness = buildHarness({ actorId: CUSTOMER_ID });

    await GET(harness.req, harness.res);

    expect(harness.status).not.toHaveBeenCalled();
    expect(harness.json).toHaveBeenCalledWith({
      order: expect.objectContaining({ orderId: ORDER_ID }),
    });
  });

  it("404s a request with neither a token nor a session", async () => {
    const harness = buildHarness({});

    await GET(harness.req, harness.res);

    expectNotFound(harness);
  });

  it("404s another customer's session rather than 403ing, which would confirm the order exists", async () => {
    const harness = buildHarness({ actorId: "cus_someone_else" });

    await GET(harness.req, harness.res);

    expectNotFound(harness);
  });

  it("404s a token minted for a different order", async () => {
    const harness = buildHarness({ token: issueToken("order_SOMEONE_ELSE") });

    await GET(harness.req, harness.res);

    expectNotFound(harness);
  });

  it("404s a token signed with the wrong secret", async () => {
    const forged = signOrderAccessToken(
      { oid: ORDER_ID, exp: Date.now() + 60_000 },
      "wrong-secret",
    );
    const harness = buildHarness({ token: forged });

    await GET(harness.req, harness.res);

    expectNotFound(harness);
  });

  it("404s a valid token for an order that no longer exists", async () => {
    const harness = buildHarness({ token: issueToken(), orderExists: false });

    await GET(harness.req, harness.res);

    expectNotFound(harness);
  });
});
