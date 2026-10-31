import { cartSignature, signShippingQuote } from "../../lib/shipping-quote.js";
import ShipStationFulfillmentProviderService from "./service.js";

const SECRET = "test-shipping-secret";

const address = {
  country_code: "us",
  postal_code: "78756",
  city: "Austin",
  province: "tx",
};

const cart = {
  items: [{ variantId: "variant_1", quantity: 1 }],
  postalCode: address.postal_code,
  countryCode: address.country_code,
};

function issueToken(
  overrides: Partial<Parameters<typeof signShippingQuote>[0]> = {},
) {
  return signShippingQuote(
    {
      rid: "se-1",
      amt: 7.42,
      cur: "usd",
      svc: "usps_ground_advantage",
      car: "usps",
      cs: cartSignature(cart),
      exp: Date.now() + 30 * 60_000,
      ...overrides,
    },
    SECRET,
  );
}

function makeContext(overrides: Partial<typeof address> = {}) {
  return {
    items: [{ quantity: 1, variant: { id: "variant_1" } }],
    shipping_address: { ...address, ...overrides },
  } as never;
}

function makeProvider(storedFlatRate?: string) {
  const listSiteContentEntries = jest
    .fn()
    .mockResolvedValue(
      storedFlatRate == null
        ? []
        : [{ key: "shipping_flat_rate", value: storedFlatRate }],
    );
  const logger = { warn: jest.fn(), error: jest.fn() };

  const provider = new ShipStationFulfillmentProviderService({
    logger: logger as never,
    siteContent: { listSiteContentEntries } as never,
  } as never);

  return { provider, listSiteContentEntries, logger };
}

describe("ShipStationFulfillmentProviderService", () => {
  const originalSecret = process.env.SHIPPING_QUOTE_SECRET;

  beforeEach(() => {
    process.env.SHIPPING_QUOTE_SECRET = SECRET;
  });

  afterAll(() => {
    process.env.SHIPPING_QUOTE_SECRET = originalSecret;
  });

  it("charges the signed amount directly when the quote token is valid", async () => {
    const { provider, listSiteContentEntries } = makeProvider("12.00");

    const result = await provider.calculatePrice(
      {},
      {
        rateId: "se-1",
        serviceCode: "usps_ground_advantage",
        quoteToken: issueToken(),
        amount: 7.42,
      },
      makeContext(),
    );

    expect(result).toEqual({
      calculated_amount: 7.42,
      is_calculated_price_tax_inclusive: false,
    });
    expect(listSiteContentEntries).not.toHaveBeenCalled();
  });

  it("re-prices an expired flat-rate quote at the current flat rate", async () => {
    const { provider } = makeProvider("10.00");

    const result = await provider.calculatePrice(
      {},
      {
        rateId: "flat_rate",
        serviceCode: "flat_rate",
        quoteToken: issueToken({ svc: "flat_rate", amt: 10, exp: 1 }),
        amount: 10,
      },
      makeContext(),
    );

    expect(result).toEqual({
      calculated_amount: 10,
      is_calculated_price_tax_inclusive: false,
    });
  });

  it("uses the default flat rate when the owner has never set one", async () => {
    const { provider } = makeProvider();

    const result = await provider.calculatePrice(
      {},
      {
        rateId: "flat_rate",
        serviceCode: "flat_rate",
        quoteToken: issueToken({ cs: "wrong-signature" }),
        amount: 10,
      },
      makeContext(),
    );

    expect(result.calculated_amount).toBe(10);
  });

  it("throws when the flat rate has moved out of tolerance since the quote", async () => {
    const { provider } = makeProvider("25.00");

    await expect(
      provider.calculatePrice(
        {},
        {
          rateId: "flat_rate",
          serviceCode: "flat_rate",
          quoteToken: issueToken({ cs: "wrong-signature" }),
          amount: 10,
        },
        makeContext(),
      ),
    ).rejects.toThrow(/out of tolerance/);
  });

  it("refuses to re-price a quote for a service that is no longer offered", async () => {
    const { provider } = makeProvider("7.42");

    await expect(
      provider.calculatePrice(
        {},
        {
          rateId: "se-1",
          serviceCode: "usps_ground_advantage",
          quoteToken: issueToken({ cs: "wrong-signature" }),
          amount: 7.42,
        },
        makeContext(),
      ),
    ).rejects.toThrow(/No current shipping rate/);
  });
});
