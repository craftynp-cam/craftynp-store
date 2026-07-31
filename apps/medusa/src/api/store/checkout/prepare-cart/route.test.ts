import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { CheckoutPrepareRequest } from "@craftynp/types";

import {
  cartSignature,
  signShippingQuote,
} from "../../../../lib/shipping-quote";
import { signTaxQuote, taxSignature } from "../../../../lib/tax-quote";

const mockCreateCartRun = jest.fn();
const mockUpdateCartRun = jest.fn();
const mockAddShippingMethodRun = jest.fn();
const mockCreatePaymentCollectionRun = jest.fn();
const mockCreatePaymentSessionsRun = jest.fn();

jest.mock("@medusajs/medusa/core-flows", () => ({
  createCartWorkflow: () => ({ run: mockCreateCartRun }),
  updateCartWorkflow: () => ({ run: mockUpdateCartRun }),
  addShippingMethodToCartWorkflow: () => ({ run: mockAddShippingMethodRun }),
  createPaymentCollectionForCartWorkflow: () => ({
    run: mockCreatePaymentCollectionRun,
  }),
  createPaymentSessionsWorkflow: () => ({ run: mockCreatePaymentSessionsRun }),
}));

import { POST } from "./route";

const SHIPPING_SECRET = "shipping-secret";
const TAX_SECRET = "tax-secret";
const CART_ID = "cart_01";
const SHIPPING_AMOUNT = 8.45;

const ADDRESS = {
  firstName: "Ada",
  lastName: "Lovelace",
  phone: "5551234567",
  address1: "1 Analytical Way",
  address2: "",
  city: "Austin",
  state: "TX",
  postalCode: "78701",
  countryCode: "US",
};

const ITEMS = [{ variantId: "variant_01", quantity: 2 }];

function buildBody(
  overrides: Partial<CheckoutPrepareRequest> = {},
): CheckoutPrepareRequest {
  const shippingQuoteToken = signShippingQuote(
    {
      rid: "rate_01",
      amt: SHIPPING_AMOUNT,
      cur: "usd",
      svc: "usps_ground_advantage",
      car: "usps",
      cs: cartSignature({
        items: ITEMS,
        postalCode: ADDRESS.postalCode,
        countryCode: ADDRESS.countryCode,
      }),
      exp: Date.now() + 60_000,
    },
    SHIPPING_SECRET,
  );

  const taxQuoteToken = signTaxQuote(
    {
      cid: "taxcalc_01",
      amt: 1.23,
      cur: "usd",
      ts: taxSignature({
        items: ITEMS,
        postalCode: ADDRESS.postalCode,
        countryCode: ADDRESS.countryCode,
        state: ADDRESS.state,
        city: ADDRESS.city,
        shippingAmount: SHIPPING_AMOUNT,
      }),
      exp: Date.now() + 60_000,
    },
    TAX_SECRET,
  );

  return {
    email: "ada@example.com",
    shippingAddress: ADDRESS,
    billingAddress: ADDRESS,
    items: ITEMS,
    shippingRateId: "rate_01",
    shippingServiceCode: "usps_ground_advantage",
    shippingQuoteToken,
    taxQuoteToken,
    ...overrides,
  } as CheckoutPrepareRequest;
}

type PaymentSession = {
  id: string;
  provider_id: string;
  data: { client_secret: string };
};

type CartRow = {
  id: string;
  completed_at?: string | null;
  currency_code: string;
  item_subtotal: number;
  shipping_subtotal: number;
  tax_total: number;
  total: number;
  shipping_methods?: { id: string }[];
  payment_collection?: {
    id: string;
    amount: number;
    payment_sessions: PaymentSession[];
  } | null;
};

function cartRow(overrides: Partial<CartRow> = {}): CartRow {
  return {
    id: CART_ID,
    completed_at: null,
    currency_code: "usd",
    item_subtotal: 100,
    shipping_subtotal: SHIPPING_AMOUNT,
    tax_total: 1.23,
    total: 108.45,
    shipping_methods: [],
    payment_collection: null,
    ...overrides,
  };
}

type Harness = {
  req: MedusaRequest<CheckoutPrepareRequest>;
  res: MedusaResponse;
  json: jest.Mock;
  status: jest.Mock;
};

/**
 * Cart reads return `before` until a mutating workflow has run and `after`
 * once one has. That distinction is the whole point of this route's ordering:
 * `updateCartWorkflow`/`addShippingMethodToCartWorkflow` can move the total,
 * and Medusa responds by deleting the payment sessions — so a cart read taken
 * before them describes a payment session that no longer exists.
 */
function buildHarness(options: {
  body: CheckoutPrepareRequest;
  before?: CartRow | null;
  after?: CartRow;
}): Harness {
  let mutated = false;
  const markMutated = async (result: unknown) => {
    mutated = true;
    return result;
  };

  mockCreateCartRun.mockImplementation(() =>
    markMutated({ result: { id: CART_ID } }),
  );
  mockUpdateCartRun.mockImplementation(() =>
    markMutated({ result: { id: CART_ID } }),
  );
  mockAddShippingMethodRun.mockImplementation(() =>
    markMutated({ result: {} }),
  );

  const graph = jest.fn(async ({ entity }: { entity: string }) => {
    if (entity === "region") {
      return {
        data: [
          { id: "reg_01", currency_code: "usd", countries: [{ iso_2: "us" }] },
        ],
      };
    }
    if (entity === "shipping_option") {
      return { data: [{ id: "so_01" }] };
    }
    if (!mutated) {
      return { data: options.before ? [options.before] : [] };
    }
    return { data: [options.after ?? cartRow()] };
  });

  const json = jest.fn();
  const status = jest.fn(() => ({ json }));

  return {
    req: {
      validatedBody: options.body,
      scope: {
        resolve: (key: string) =>
          key === ContainerRegistrationKeys.QUERY
            ? { graph }
            : { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
      },
    } as unknown as MedusaRequest<CheckoutPrepareRequest>,
    res: { json, status } as unknown as MedusaResponse,
    json,
    status,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.SHIPPING_QUOTE_SECRET = SHIPPING_SECRET;
  process.env.TAX_QUOTE_SECRET = TAX_SECRET;

  mockCreatePaymentCollectionRun.mockResolvedValue({
    result: { id: "paycol_01" },
  });
  mockCreatePaymentSessionsRun.mockResolvedValue({
    result: { id: "payses_new", data: { client_secret: "pi_new_secret" } },
  });
});

describe("POST /store/checkout/prepare-cart", () => {
  it("mints a fresh payment session when the cart update cancelled the old one", async () => {
    // Medusa's refreshPaymentCollectionForCartWorkflow deletes the payment
    // sessions — cancelling their Stripe PaymentIntents — whenever the cart
    // total moves. Returning the pre-update snapshot's client secret hands the
    // storefront an intent in a terminal state, which Stripe.js refuses to
    // initialize Elements against.
    const { req, res, json } = buildHarness({
      body: buildBody({ cartId: CART_ID }),
      before: cartRow({
        payment_collection: {
          id: "paycol_01",
          amount: 108.45,
          payment_sessions: [
            {
              id: "payses_cancelled",
              provider_id: "pp_stripe_stripe",
              data: { client_secret: "pi_cancelled_secret" },
            },
          ],
        },
      }),
      after: cartRow({
        total: 112.9,
        payment_collection: {
          id: "paycol_01",
          amount: 112.9,
          payment_sessions: [],
        },
      }),
    });

    await POST(req, res);

    expect(mockCreatePaymentSessionsRun).toHaveBeenCalledTimes(1);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ clientSecret: "pi_new_secret" }),
    );
  });

  it("replaces a session whose collection amount no longer matches the cart total", async () => {
    const staleCollection = {
      id: "paycol_01",
      amount: 108.45,
      payment_sessions: [
        {
          id: "payses_stale",
          provider_id: "pp_stripe_stripe",
          data: { client_secret: "pi_stale_secret" },
        },
      ],
    };

    const { req, res, json } = buildHarness({
      body: buildBody({ cartId: CART_ID }),
      before: cartRow({ payment_collection: staleCollection }),
      after: cartRow({ total: 112.9, payment_collection: staleCollection }),
    });

    await POST(req, res);

    expect(mockCreatePaymentSessionsRun).toHaveBeenCalledTimes(1);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ clientSecret: "pi_new_secret" }),
    );
  });

  it("reuses a live session when the total is unchanged", async () => {
    const liveCollection = {
      id: "paycol_01",
      amount: 108.45,
      payment_sessions: [
        {
          id: "payses_live",
          provider_id: "pp_stripe_stripe",
          data: { client_secret: "pi_live_secret" },
        },
      ],
    };

    const { req, res, json } = buildHarness({
      body: buildBody({ cartId: CART_ID }),
      before: cartRow({ payment_collection: liveCollection }),
      after: cartRow({ payment_collection: liveCollection }),
    });

    await POST(req, res);

    expect(mockCreatePaymentSessionsRun).not.toHaveBeenCalled();
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ clientSecret: "pi_live_secret" }),
    );
  });

  it("re-attaches the shipping method with the request's own quote token", async () => {
    const body = buildBody({ cartId: CART_ID });
    // The cart already carries a method from the previous address, signed with
    // the previous quote token — it must not be left in place.
    const { req, res } = buildHarness({
      body,
      before: cartRow({ shipping_methods: [{ id: "sm_previous" }] }),
      after: cartRow({ shipping_methods: [{ id: "sm_fresh" }] }),
    });

    await POST(req, res);

    expect(mockAddShippingMethodRun).toHaveBeenCalledTimes(1);
    expect(mockAddShippingMethodRun).toHaveBeenCalledWith({
      input: {
        cart_id: CART_ID,
        options: [
          {
            id: "so_01",
            data: {
              rateId: "rate_01",
              serviceCode: "usps_ground_advantage",
              quoteToken: body.shippingQuoteToken,
              amount: SHIPPING_AMOUNT,
            },
          },
        ],
      },
    });
  });

  it("starts a fresh cart when the draft's cart was already completed", async () => {
    // The storefront only clears its stored cartId once /checkout/complete
    // returns, so an order placed by the AC9 webhook after that call failed
    // leaves a completed cart id in the draft. Rejecting it would wedge the
    // shopper out of checkout behind a Try again button that re-sends the
    // same dead id.
    const { req, res, json } = buildHarness({
      body: buildBody({ cartId: CART_ID }),
      before: cartRow({ completed_at: "2026-07-30T00:00:00.000Z" }),
    });

    await POST(req, res);

    expect(mockUpdateCartRun).not.toHaveBeenCalled();
    expect(mockCreateCartRun).toHaveBeenCalledTimes(1);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ cartId: CART_ID }),
    );
  });

  it("starts a fresh cart when the draft's cart no longer exists", async () => {
    const { req, res, json } = buildHarness({
      body: buildBody({ cartId: CART_ID }),
      before: null,
    });

    await POST(req, res);

    expect(mockUpdateCartRun).not.toHaveBeenCalled();
    expect(mockCreateCartRun).toHaveBeenCalledTimes(1);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ cartId: CART_ID }),
    );
  });

  it("creates a cart, collection and session on a first prepare", async () => {
    const { req, res, json } = buildHarness({ body: buildBody() });

    await POST(req, res);

    expect(mockCreateCartRun).toHaveBeenCalledTimes(1);
    expect(mockUpdateCartRun).not.toHaveBeenCalled();
    expect(mockCreatePaymentCollectionRun).toHaveBeenCalledTimes(1);
    expect(mockCreatePaymentSessionsRun).toHaveBeenCalledWith({
      input: {
        payment_collection_id: "paycol_01",
        provider_id: "pp_stripe_stripe",
      },
    });
    expect(json).toHaveBeenCalledWith({
      cartId: CART_ID,
      clientSecret: "pi_new_secret",
      totals: {
        subtotal: 100,
        shipping: SHIPPING_AMOUNT,
        tax: 1.23,
        total: 108.45,
        currencyCode: "usd",
      },
    });
  });

  it("rejects a tampered shipping quote before touching any workflow", async () => {
    const { req, res, status, json } = buildHarness({
      body: buildBody({ shippingQuoteToken: "not.a.token" }),
      before: cartRow(),
    });

    await POST(req, res);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "invalid_shipping_quote" }),
    );
    expect(mockCreateCartRun).not.toHaveBeenCalled();
  });
});
