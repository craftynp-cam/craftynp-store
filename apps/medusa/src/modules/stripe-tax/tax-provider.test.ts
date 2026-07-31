import Stripe from "stripe";

import StripeTaxTaxProvider from "./tax-provider.js";

const providerOptions = {
  secretKey: "sk_test_123",
  defaultTaxCode: "txcd_99999999",
  shippingTaxCode: "txcd_92010001",
  timeoutMs: 5000,
  maxRetries: 2,
};

const context = {
  address: {
    country_code: "us",
    province_code: "in",
    city: "Indianapolis",
    postal_code: "46201",
  },
};

function makeProvider(logger = { warn: jest.fn(), error: jest.fn() }) {
  const provider = new StripeTaxTaxProvider(
    { logger: logger as never },
    providerOptions,
  );

  const client = (provider as unknown as { client_: Stripe }).client_;
  const create = jest.spyOn(client.tax.calculations, "create");

  return { provider, logger, create };
}

function calculationResponse(overrides: Partial<Stripe.Tax.Calculation> = {}) {
  return {
    id: "taxcalc_1",
    currency: "usd",
    line_items: { data: [] },
    shipping_cost: null,
    ...overrides,
  } as never;
}

describe("StripeTaxTaxProvider", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("sends the real item lines when items are present, with no placeholder", async () => {
    const { provider, create } = makeProvider();
    create.mockResolvedValueOnce(
      calculationResponse({
        line_items: {
          data: [{ reference: "item_1", amount: 2000, amount_tax: 140 }],
        },
      } as never),
    );

    const result = await provider.getTaxLines(
      [
        {
          line_item: {
            id: "item_1",
            unit_price: 20,
            quantity: 1,
            currency_code: "usd",
          },
        },
      ],
      [],
      context,
    );

    const params = create.mock.calls[0]?.[0];
    expect(params?.line_items).toEqual([
      expect.objectContaining({ reference: "item_1" }),
    ]);
    expect(result).toEqual([
      {
        rate: 7,
        code: "sales_tax",
        name: "Sales tax",
        provider_id: "stripe-tax",
        line_item_id: "item_1",
      },
    ]);
  });

  it("substitutes a zero-amount placeholder item for a shipping-only call, and never returns it", async () => {
    const { provider, create } = makeProvider();
    create.mockResolvedValueOnce(
      calculationResponse({
        shipping_cost: { amount: 742, amount_tax: 53 },
      } as never),
    );

    const result = await provider.getTaxLines(
      [],
      [
        {
          shipping_line: {
            id: "shipping_1",
            unit_price: 7.42,
            currency_code: "usd",
          },
        },
      ],
      context,
    );

    const params = create.mock.calls[0]?.[0];
    expect(params?.line_items).toHaveLength(1);
    expect(params?.line_items?.[0]).toMatchObject({ amount: 0, quantity: 1 });

    expect(result).toEqual([
      {
        rate: expect.closeTo(7.1429, 3),
        code: "sales_tax",
        name: "Sales tax",
        provider_id: "stripe-tax",
        shipping_line_id: "shipping_1",
      },
    ]);
  });

  it("wraps and logs a Stripe error", async () => {
    const { provider, create, logger } = makeProvider();
    create.mockRejectedValueOnce(
      new Stripe.errors.StripeAPIError({
        message: "server error",
        type: "api_error",
      }),
    );

    await expect(
      provider.getTaxLines(
        [
          {
            line_item: {
              id: "item_1",
              unit_price: 20,
              quantity: 1,
              currency_code: "usd",
            },
          },
        ],
        [],
        context,
      ),
    ).rejects.toMatchObject({ reason: "http_error" });

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("[stripe-tax:unavailable] reason=http_error"),
    );
  });
});
