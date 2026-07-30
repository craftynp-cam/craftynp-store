import Stripe from "stripe";

import StripeTaxModuleService from "./service.js";

const validOptions = {
  secretKey: "sk_test_123",
  defaultTaxCode: "txcd_99999999",
  shippingTaxCode: "txcd_92010001",
  timeoutMs: 5000,
  maxRetries: 2,
  cacheTtlSeconds: 900,
};

const calculationInput = {
  currencyCode: "usd",
  destination: {
    countryCode: "us",
    postalCode: "46201",
    city: "Indianapolis",
    state: "IN",
  },
  lineItems: [{ reference: "variant_1", amount: 19.99, quantity: 1 }],
  shippingAmount: 7.42,
};

function createMemoryCache() {
  const store = new Map<string, unknown>();
  return {
    get: jest.fn(async (key: string) => store.get(key) ?? null),
    set: jest.fn(async (key: string, value: unknown) => {
      store.set(key, value);
    }),
  };
}

function makeService(
  cache = createMemoryCache(),
  logger = { warn: jest.fn(), error: jest.fn() },
) {
  const service = new StripeTaxModuleService(
    { logger: logger as never, cache: cache as never },
    validOptions,
  );

  const client = (service as unknown as { client_: Stripe }).client_;
  const create = jest.spyOn(client.tax.calculations, "create");

  return { service, cache, logger, create };
}

describe("StripeTaxModuleService", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns a normalized calculation on the happy path", async () => {
    const { service, create } = makeService();
    create.mockResolvedValueOnce({
      id: "taxcalc_1",
      tax_amount_exclusive: 432,
      currency: "usd",
    } as never);

    const result = await service.calculateTax(calculationInput);

    expect(result).toEqual({
      calculationId: "taxcalc_1",
      taxAmount: 4.32,
      currencyCode: "usd",
    });
  });

  it("returns a zero-tax calculation without error for a state with no obligation", async () => {
    const { service, create } = makeService();
    create.mockResolvedValueOnce({
      id: "taxcalc_2",
      tax_amount_exclusive: 0,
      currency: "usd",
    } as never);

    const result = await service.calculateTax(calculationInput);

    expect(result.taxAmount).toBe(0);
  });

  it("throws invalid_address when Stripe rejects the destination", async () => {
    const { service, create } = makeService();
    const error = new Stripe.errors.StripeInvalidRequestError({
      message: "bad address",
      param: "customer_details[address][postal_code]",
      type: "invalid_request_error",
    });
    create.mockRejectedValueOnce(error);

    await expect(
      service.calculateTax(calculationInput),
    ).rejects.toMatchObject({ reason: "invalid_address" });
  });

  it("throws timeout on a connection error", async () => {
    const { service, create } = makeService();
    create.mockRejectedValueOnce(
      new Stripe.errors.StripeConnectionError({
        message: "connect ETIMEDOUT",
        type: "api_error",
      }),
    );

    await expect(
      service.calculateTax(calculationInput),
    ).rejects.toMatchObject({ reason: "timeout" });
  });

  it("throws http_error on any other Stripe error", async () => {
    const { service, create } = makeService();
    create.mockRejectedValueOnce(
      new Stripe.errors.StripeAPIError({
        message: "server error",
        type: "api_error",
      }),
    );

    await expect(
      service.calculateTax(calculationInput),
    ).rejects.toMatchObject({ reason: "http_error" });
  });

  it("skips the Stripe call entirely on a cache hit", async () => {
    const cache = createMemoryCache();
    const { service, create } = makeService(cache);
    create.mockResolvedValueOnce({
      id: "taxcalc_3",
      tax_amount_exclusive: 100,
      currency: "usd",
    } as never);

    await service.calculateTax(calculationInput);
    await service.calculateTax(calculationInput);

    expect(create).toHaveBeenCalledTimes(1);
  });

  it("never caches a failed calculation", async () => {
    const cache = createMemoryCache();
    const { service, create } = makeService(cache);
    create.mockRejectedValueOnce(
      new Stripe.errors.StripeAPIError({
        message: "server error",
        type: "api_error",
      }),
    );

    await expect(service.calculateTax(calculationInput)).rejects.toThrow();
    expect(cache.set).not.toHaveBeenCalled();
  });
});
