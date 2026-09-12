import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { CheckoutPrepareRequest } from "@craftynp/types";

import {
  cartSignature,
  signShippingQuote,
} from "../../../../lib/shipping-quote";
import { signTaxQuote, taxSignature } from "../../../../lib/tax-quote";
import { priceSignature, signPriceQuote } from "../../../../lib/price-quote";

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
const PRICE_SECRET = "price-secret";
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

const AREA_METADATA = {
  customizable: "true",
  customization_size: "optional",
  customization_size_min_inches: "2",
  customization_size_max_inches: "48",
  customization_size_rate_per_sq_inch: "0.055",
  customization_size_price_floor: "4",
};

const DIMENSIONS = { widthInches: 8, heightInches: 10 };

// 1.15 * 0.055 * 80, with no tier in play since the mock prices every quantity
// the same.
const AREA_UNIT_PRICE = 5.06;

function priceQuoteToken(overrides: { quantity?: number } = {}) {
  return signPriceQuote(
    {
      amt: AREA_UNIT_PRICE,
      cur: "usd",
      ps: priceSignature({
        variantId: "variant_01",
        quantity: overrides.quantity ?? 2,
        widthInches: DIMENSIONS.widthInches,
        heightInches: DIMENSIONS.heightInches,
      }),
      exp: Date.now() + 60_000,
    },
    PRICE_SECRET,
  );
}

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

type CartItemRow = {
  variant_id: string;
  quantity: number;
  unit_price?: number;
  is_custom_price?: boolean;
  metadata?: Record<string, unknown>;
};

type CartRow = {
  id: string;
  completed_at?: string | null;
  items?: CartItemRow[];
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
    // Matches ITEMS, because a cart this route created always does. Leave it
    // off and every reuse test silently exercises the fresh-cart branch.
    items: [{ variant_id: "variant_01", quantity: 2 }],
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
  optionValues?: { metadata: Record<string, unknown> }[];
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
    if (entity === "variant") {
      return {
        data: [
          {
            id: "variant_01",
            product: {
              metadata: AREA_METADATA,
              categories: [{ metadata: { artwork_min_dpi: "300" } }],
            },
            options: options.optionValues ?? [],
            calculated_price: {
              calculated_amount: 1.15,
              original_amount: 1.15,
              currency_code: "usd",
            },
          },
        ],
      };
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
  process.env.PRICE_QUOTE_SECRET = PRICE_SECRET;

  mockCreatePaymentCollectionRun.mockResolvedValue({
    result: { id: "paycol_01" },
  });
  mockCreatePaymentSessionsRun.mockResolvedValue({
    result: { id: "payses_new", data: { client_secret: "pi_new_secret" } },
  });
});

describe("POST /store/checkout/prepare-cart area pricing", () => {
  const areaItems = [
    {
      variantId: "variant_01",
      quantity: 2,
      dimensions: DIMENSIONS,
      priceQuoteToken: priceQuoteToken(),
    },
  ];

  it("re-derives the area price and sets it on the line itself", async () => {
    const { req, res } = buildHarness({
      body: buildBody({ items: areaItems }),
      before: null,
    });

    await POST(req, res);

    const input = mockCreateCartRun.mock.calls[0]?.[0]?.input;
    expect(input.items[0]).toMatchObject({
      variant_id: "variant_01",
      quantity: 2,
      unit_price: AREA_UNIT_PRICE,
      metadata: expect.objectContaining({ dimensions: DIMENSIONS }),
    });
  });

  it("prices from the product, not from the amount the token carries", async () => {
    // A validly-signed token naming a penny. The signature only says which
    // line was quoted; the amount charged is the one re-derived here, so a
    // token minted against a rate the owner has since raised cannot hold.
    const stale = signPriceQuote(
      {
        amt: 0.01,
        cur: "usd",
        ps: priceSignature({
          variantId: "variant_01",
          quantity: 2,
          widthInches: DIMENSIONS.widthInches,
          heightInches: DIMENSIONS.heightInches,
        }),
        exp: Date.now() + 60_000,
      },
      PRICE_SECRET,
    );

    const { req, res } = buildHarness({
      body: buildBody({
        items: [{ ...areaItems[0]!, priceQuoteToken: stale }],
      }),
      before: null,
    });

    await POST(req, res);

    const input = mockCreateCartRun.mock.calls[0]?.[0]?.input;
    expect(input.items[0].unit_price).toBe(AREA_UNIT_PRICE);
  });

  it("leaves an ordinary line for Medusa to price, so its tier still applies", async () => {
    const { req, res } = buildHarness({ body: buildBody(), before: null });

    await POST(req, res);

    const input = mockCreateCartRun.mock.calls[0]?.[0]?.input;
    expect(input.items[0]).not.toHaveProperty("unit_price");
  });

  it("refuses a quote replayed against a different quantity", async () => {
    const { req, res, status, json } = buildHarness({
      body: buildBody({
        items: [
          {
            ...areaItems[0]!,
            priceQuoteToken: priceQuoteToken({ quantity: 99 }),
          },
        ],
      }),
      before: null,
    });

    await POST(req, res);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "invalid_price_quote" }),
    );
    expect(mockCreateCartRun).not.toHaveBeenCalled();
  });

  it("refuses an area-priced line that carries no quote at all", async () => {
    const { req, res, status } = buildHarness({
      body: buildBody({
        items: [
          { variantId: "variant_01", quantity: 2, dimensions: DIMENSIONS },
        ],
      }),
      before: null,
    });

    await POST(req, res);

    expect(status).toHaveBeenCalledWith(400);
    expect(mockCreateCartRun).not.toHaveBeenCalled();
  });

  it("refuses dimensions outside the product's own bounds", async () => {
    const outOfBounds = { widthInches: 8, heightInches: 500 };
    const { req, res, status } = buildHarness({
      body: buildBody({
        items: [
          {
            variantId: "variant_01",
            quantity: 2,
            dimensions: outOfBounds,
            priceQuoteToken: signPriceQuote(
              {
                amt: 1,
                cur: "usd",
                ps: priceSignature({
                  variantId: "variant_01",
                  quantity: 2,
                  widthInches: outOfBounds.widthInches,
                  heightInches: outOfBounds.heightInches,
                }),
                exp: Date.now() + 60_000,
              },
              PRICE_SECRET,
            ),
          },
        ],
      }),
      before: null,
    });

    await POST(req, res);

    expect(status).toHaveBeenCalledWith(400);
    expect(mockCreateCartRun).not.toHaveBeenCalled();
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

  it("reuses the cart while only the address has changed", async () => {
    // This is what reuse is for: an address edit keeps the shopper's
    // PaymentIntent alive rather than minting a new one on every keystroke.
    const { req, res } = buildHarness({
      body: buildBody({ cartId: CART_ID }),
      before: cartRow(),
    });

    await POST(req, res);

    expect(mockUpdateCartRun).toHaveBeenCalled();
    expect(mockCreateCartRun).not.toHaveBeenCalled();
  });

  it("starts a fresh cart when the line items no longer match", async () => {
    // updateCartWorkflow cannot change line items, so reusing here would
    // prepare — and charge — the configuration the cart was created with.
    const { req, res } = buildHarness({
      body: buildBody({ cartId: CART_ID }),
      before: cartRow({
        items: [{ variant_id: "variant_01", quantity: 5 }],
      }),
    });

    await POST(req, res);

    expect(mockCreateCartRun).toHaveBeenCalled();
    expect(mockUpdateCartRun).not.toHaveBeenCalled();
  });

  it("starts a fresh cart when only the custom size changed", async () => {
    // Every custom size shares one variant, so the variant and quantity are
    // unchanged and the dimensions are the only thing that says otherwise.
    const areaItem = {
      variantId: "variant_01",
      quantity: 2,
      dimensions: DIMENSIONS,
      priceQuoteToken: priceQuoteToken(),
    };

    const { req, res } = buildHarness({
      body: buildBody({ cartId: CART_ID, items: [areaItem] }),
      before: cartRow({
        items: [
          {
            variant_id: "variant_01",
            quantity: 2,
            unit_price: AREA_UNIT_PRICE,
            is_custom_price: true,
            metadata: {
              dimensions: { widthInches: 12, heightInches: 16 },
            },
          },
        ],
      }),
    });

    await POST(req, res);

    expect(mockCreateCartRun).toHaveBeenCalled();
    expect(mockUpdateCartRun).not.toHaveBeenCalled();
  });

  it("reuses a cart whose area-priced line is unchanged", async () => {
    const areaItem = {
      variantId: "variant_01",
      quantity: 2,
      dimensions: DIMENSIONS,
      priceQuoteToken: priceQuoteToken(),
    };

    const { req, res } = buildHarness({
      body: buildBody({ cartId: CART_ID, items: [areaItem] }),
      before: cartRow({
        items: [
          {
            variant_id: "variant_01",
            quantity: 2,
            unit_price: AREA_UNIT_PRICE,
            is_custom_price: true,
            metadata: { dimensions: DIMENSIONS },
          },
        ],
      }),
    });

    await POST(req, res);

    expect(mockUpdateCartRun).toHaveBeenCalled();
    expect(mockCreateCartRun).not.toHaveBeenCalled();
  });

  it("starts a fresh cart when the owner has changed the rate since", async () => {
    // Same variant, quantity and size, but the price this backend now derives
    // differs from the one frozen on the line — so the cart is out of date.
    const areaItem = {
      variantId: "variant_01",
      quantity: 2,
      dimensions: DIMENSIONS,
      priceQuoteToken: priceQuoteToken(),
    };

    const { req, res } = buildHarness({
      body: buildBody({ cartId: CART_ID, items: [areaItem] }),
      before: cartRow({
        items: [
          {
            variant_id: "variant_01",
            quantity: 2,
            unit_price: 1.23,
            is_custom_price: true,
            metadata: { dimensions: DIMENSIONS },
          },
        ],
      }),
    });

    await POST(req, res);

    expect(mockCreateCartRun).toHaveBeenCalled();
    expect(mockUpdateCartRun).not.toHaveBeenCalled();
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

describe("POST /store/checkout/prepare-cart customization", () => {
  const ARTWORK = {
    storageKey: "staging/up_1.png",
    fileName: "logo.png",
    mimeType: "image/png" as const,
    sizeBytes: 51_200,
    widthPx: 3000,
    heightPx: 3000,
  };

  const PRESET_SIZE = [
    { metadata: { width_inches: "8", height_inches: "10" } },
  ];

  function customizedItems(
    customization: Record<string, unknown>,
  ): CheckoutPrepareRequest["items"] {
    return [
      {
        variantId: "variant_01",
        quantity: 2,
        customization,
      },
    ] as CheckoutPrepareRequest["items"];
  }

  it("stores the validated customization on the line item", async () => {
    const { req, res } = buildHarness({
      body: buildBody({
        items: customizedItems({
          artwork: ARTWORK,
          customText: { value: "  Ellie  " },
          orderNotes: "Matte finish",
        }),
      }),
      before: null,
      optionValues: PRESET_SIZE,
    });

    await POST(req, res);

    const input = mockCreateCartRun.mock.calls[0]?.[0]?.input;
    expect(input.items[0].metadata.customization).toEqual({
      artwork: ARTWORK,
      customText: { value: "Ellie" },
      orderNotes: "Matte finish",
    });
  });

  it("refuses artwork too coarse for the size the option value names", async () => {
    const { req, res, status, json } = buildHarness({
      body: buildBody({
        items: customizedItems({
          artwork: { ...ARTWORK, widthPx: 300, heightPx: 300 },
        }),
      }),
      before: null,
      optionValues: PRESET_SIZE,
    });

    await POST(req, res);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "invalid_customization",
        message: expect.stringContaining("300 DPI"),
      }),
    );
    expect(mockCreateCartRun).not.toHaveBeenCalled();
  });

  it("accepts the same artwork once the preset size is small enough to print it", async () => {
    const { req, res } = buildHarness({
      body: buildBody({
        items: customizedItems({
          artwork: { ...ARTWORK, widthPx: 300, heightPx: 300 },
        }),
      }),
      before: null,
      optionValues: [{ metadata: { width_inches: "1", height_inches: "1" } }],
    });

    await POST(req, res);

    expect(mockCreateCartRun).toHaveBeenCalled();
  });

  it("starts a fresh cart when only the artwork changed", async () => {
    const { req, res } = buildHarness({
      body: buildBody({
        cartId: CART_ID,
        items: customizedItems({ artwork: ARTWORK }),
      }),
      before: cartRow({
        items: [
          {
            variant_id: "variant_01",
            quantity: 2,
            metadata: {
              customization: {
                artwork: { ...ARTWORK, storageKey: "staging/up_2.png" },
              },
            },
          },
        ],
      }),
      optionValues: PRESET_SIZE,
    });

    await POST(req, res);

    expect(mockCreateCartRun).toHaveBeenCalled();
    expect(mockUpdateCartRun).not.toHaveBeenCalled();
  });

  it("reuses the cart when the artwork is unchanged", async () => {
    const { req, res } = buildHarness({
      body: buildBody({
        cartId: CART_ID,
        items: customizedItems({ artwork: ARTWORK }),
      }),
      before: cartRow({
        items: [
          {
            variant_id: "variant_01",
            quantity: 2,
            metadata: { customization: { artwork: ARTWORK } },
          },
        ],
      }),
      optionValues: PRESET_SIZE,
    });

    await POST(req, res);

    expect(mockUpdateCartRun).toHaveBeenCalled();
    expect(mockCreateCartRun).not.toHaveBeenCalled();
  });
});
