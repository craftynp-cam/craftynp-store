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

function makeProvider(graphResult: unknown[] = []) {
  const graph = jest.fn().mockResolvedValue({ data: graphResult });
  const getUspsRates = jest.fn();
  const logger = { warn: jest.fn(), error: jest.fn() };

  const provider = new ShipStationFulfillmentProviderService({
    logger: logger as never,
    query: { graph } as never,
    shipstation: { getUspsRates } as never,
  } as never);

  return { provider, graph, getUspsRates, logger };
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
    const { provider, graph, getUspsRates } = makeProvider();

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
    expect(graph).not.toHaveBeenCalled();
    expect(getUspsRates).not.toHaveBeenCalled();
  });

  it("re-estimates using the product's dimensions when the variant has none of its own", async () => {
    // This is the exact shape that broke: Medusa's own cart-refresh context
    // only ever fetches items.variant.{weight,length,width,height} and
    // items.product.weight, never the product's length/width/height — so a
    // variant relying on product-level dimensions always looked incomplete
    // there. The provider must re-query authoritatively instead.
    const { provider, graph, getUspsRates } = makeProvider([
      {
        id: "variant_1",
        weight: null,
        length: null,
        width: null,
        height: null,
        product: { weight: 400, length: 20, width: 15, height: 10 },
      },
    ]);
    getUspsRates.mockResolvedValue([
      {
        rateId: "se-2",
        carrierName: "USPS",
        serviceName: "USPS Ground Advantage",
        serviceCode: "usps_ground_advantage",
        amount: 7.6,
        currencyCode: "usd",
        deliveryDays: 4,
        estimatedDeliveryDate: null,
      },
    ]);

    const result = await provider.calculatePrice(
      {},
      {
        rateId: "se-1",
        serviceCode: "usps_ground_advantage",
        // A mismatched cart signature (wrong postal code) forces the
        // re-estimate path even though the token is otherwise well-formed.
        quoteToken: issueToken({
          cs: cartSignature({ ...cart, postalCode: "00000" }),
        }),
        amount: 7.42,
      },
      makeContext(),
    );

    expect(graph).toHaveBeenCalledWith(
      expect.objectContaining({ entity: "variant" }),
    );
    expect(getUspsRates).toHaveBeenCalledWith(
      expect.objectContaining({
        parcel: { weight: 400, length: 20, width: 15, height: 10 },
      }),
    );
    expect(result).toEqual({
      calculated_amount: 7.6,
      is_calculated_price_tax_inclusive: false,
    });
  });

  it("throws when neither the variant nor the product has dimensions", async () => {
    const { provider } = makeProvider([
      {
        id: "variant_1",
        weight: null,
        length: null,
        width: null,
        height: null,
        product: null,
      },
    ]);

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
    ).rejects.toThrow(/missing dimensions/);
  });

  it("throws when the fresh amount is outside tolerance of the client-claimed amount", async () => {
    const { provider, getUspsRates } = makeProvider([
      {
        id: "variant_1",
        weight: 400,
        length: 20,
        width: 15,
        height: 10,
        product: null,
      },
    ]);
    getUspsRates.mockResolvedValue([
      {
        rateId: "se-2",
        carrierName: "USPS",
        serviceName: "USPS Ground Advantage",
        serviceCode: "usps_ground_advantage",
        amount: 25.0,
        currencyCode: "usd",
        deliveryDays: 4,
        estimatedDeliveryDate: null,
      },
    ]);

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
    ).rejects.toThrow(/out of tolerance/);
  });

  it("throws when no live rate matches the requested service code", async () => {
    const { provider, getUspsRates } = makeProvider([
      {
        id: "variant_1",
        weight: 400,
        length: 20,
        width: 15,
        height: 10,
        product: null,
      },
    ]);
    getUspsRates.mockResolvedValue([]);

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
