import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { CheckoutCompleteRequest } from "@craftynp/types";

const mockCompleteCartRun = jest.fn();

jest.mock("@medusajs/medusa/core-flows", () => ({
  completeCartWorkflow: () => ({ run: mockCompleteCartRun }),
}));

import { POST } from "./route";
import { verifyOrderAccessToken } from "../../../../lib/order-access-token";

const CART_ID = "cart_01";
const ORDER = { id: "order_01", display_id: 42 };
const ORDER_ACCESS_SECRET = "test-order-access-secret";

/**
 * All three success paths — first placement, the pre-check, and the webhook
 * race — have to hand back a token that actually opens this order, which is
 * why they share one responder.
 */
function expectOrderResponse(json: jest.Mock) {
  expect(json).toHaveBeenCalledWith(
    expect.objectContaining({ orderId: ORDER.id, displayId: 42 }),
  );

  const { orderToken } = json.mock.calls[0]![0] as { orderToken: string };
  expect(
    verifyOrderAccessToken(orderToken, ORDER_ACCESS_SECRET, {
      orderId: ORDER.id,
    }),
  ).toMatchObject({ valid: true });
}

type Harness = {
  req: MedusaRequest<CheckoutCompleteRequest>;
  res: MedusaResponse;
  json: jest.Mock;
  status: jest.Mock;
  logger: { error: jest.Mock };
};

/**
 * `linkedOrder` is read at call time, not captured, so a test can have the
 * order appear partway through the request — which is exactly what AC9's
 * webhook path does when it completes the cart while this route is mid-flight.
 */
function buildHarness(linkedOrder: () => typeof ORDER | null): Harness {
  const graph = jest.fn(
    async ({
      entity,
      filters,
    }: {
      entity: string;
      filters?: Record<string, unknown>;
    }) => {
      if (entity === "order_cart") {
        const order = linkedOrder();
        return {
          data: order ? [{ order_id: order.id, order }] : [],
        };
      }
      // MikroORM rejects an unknown property outright rather than returning
      // nothing, which is what makes filtering orders on cart_id a 500 and not
      // a quiet miss.
      if (filters && "cart_id" in filters) {
        throw new Error(
          "Trying to query by not existing property Order.cart_id",
        );
      }
      return { data: [ORDER] };
    },
  );

  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const logger = { error: jest.fn() };

  return {
    req: {
      validatedBody: { cartId: CART_ID },
      scope: {
        resolve: (key: string) =>
          key === ContainerRegistrationKeys.QUERY ? { graph } : logger,
      },
    } as unknown as MedusaRequest<CheckoutCompleteRequest>,
    res: { json, status } as unknown as MedusaResponse,
    json,
    status,
    logger,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.ORDER_ACCESS_SECRET = ORDER_ACCESS_SECRET;
  mockCompleteCartRun.mockResolvedValue({ result: { id: ORDER.id } });
});

describe("POST /store/checkout/complete", () => {
  it("places the order for a cart that has none yet", async () => {
    const { req, res, json } = buildHarness(() => null);

    await POST(req, res);

    expect(mockCompleteCartRun).toHaveBeenCalledWith({
      input: { id: CART_ID },
    });
    expectOrderResponse(json);
  });

  it("returns the existing order through the order_cart link instead of placing a second", async () => {
    // Order has no cart_id column — the association lives in the link table,
    // and filtering the order entity on cart_id throws
    // "Trying to query by not existing property Order.cart_id".
    const { req, res, json } = buildHarness(() => ORDER);

    await POST(req, res);

    expect(mockCompleteCartRun).not.toHaveBeenCalled();
    expectOrderResponse(json);
  });

  it("reports success when the webhook completed the cart mid-request", async () => {
    let placedByWebhook = false;
    const { req, res, json, status, logger } = buildHarness(() =>
      placedByWebhook ? ORDER : null,
    );

    mockCompleteCartRun.mockImplementation(() => {
      placedByWebhook = true;
      return Promise.reject(new Error("Cart is already completed"));
    });

    await POST(req, res);

    expectOrderResponse(json);
    expect(status).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("reports a genuine placement failure once no order exists either way", async () => {
    const { req, res, status, json, logger } = buildHarness(() => null);
    mockCompleteCartRun.mockRejectedValue(new Error("payment not authorized"));

    await POST(req, res);

    expect(status).toHaveBeenCalledWith(502);
    // `message` carries the underlying cause, since it is the only field
    // @medusajs/js-sdk preserves for the storefront proxy to forward.
    expect(json).toHaveBeenCalledWith({
      error: "order_placement_unavailable",
      message: "order_placement_unavailable:payment not authorized",
    });
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("[checkout:complete-failed]"),
    );
  });

  it("names the cause when the workflow rejects with a non-Error", async () => {
    // Medusa's workflow engine throws errors[0].error, which is not reliably
    // an Error instance — String()-ing it put "[object Object]" in both the
    // server log and the storefront's own error message.
    const { req, res, json, logger } = buildHarness(() => null);
    mockCompleteCartRun.mockRejectedValue({
      name: "MedusaError",
      message: "Cart id not found",
    });

    await POST(req, res);

    expect(json).toHaveBeenCalledWith({
      error: "order_placement_unavailable",
      message: "order_placement_unavailable:Cart id not found",
    });
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("Cart id not found"),
    );
    expect(logger.error).not.toHaveBeenCalledWith(
      expect.stringContaining("[object Object]"),
    );
  });
});
