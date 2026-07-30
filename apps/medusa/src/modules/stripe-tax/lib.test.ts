import {
  STRIPE_TAX_UNAVAILABLE_LOG_TAG,
  buildCalculationParams,
  fromMinorUnits,
  normalizeCalculation,
  taxCacheKey,
  toMinorUnits,
  validateStripeTaxOptions,
  type StripeTaxOptions,
} from "./lib.js";

const options: StripeTaxOptions = {
  secretKey: "sk_test_123",
  defaultTaxCode: "txcd_99999999",
  shippingTaxCode: "txcd_92010001",
  timeoutMs: 5000,
  maxRetries: 2,
  cacheTtlSeconds: 900,
};

const destination = {
  countryCode: "us",
  postalCode: "46201",
  city: "Indianapolis",
  state: "IN",
};

describe("validateStripeTaxOptions", () => {
  it("does not throw when every option is present", () => {
    expect(() =>
      validateStripeTaxOptions(options as unknown as Record<string, unknown>),
    ).not.toThrow();
  });

  it("throws listing every missing option", () => {
    expect(() =>
      validateStripeTaxOptions({ secretKey: "sk_test_123" }),
    ).toThrow(/defaultTaxCode.*shippingTaxCode/s);
  });
});

describe("toMinorUnits / fromMinorUnits", () => {
  it("converts dollars to cents", () => {
    expect(toMinorUnits(0.75)).toBe(75);
    expect(toMinorUnits(12.5)).toBe(1250);
  });

  it("rounds away floating point drift", () => {
    expect(toMinorUnits(19.99)).toBe(1999);
  });

  it("converts cents back to dollars", () => {
    expect(fromMinorUnits(75)).toBe(0.75);
    expect(fromMinorUnits(1250)).toBe(12.5);
  });

  it("round-trips without drift", () => {
    expect(fromMinorUnits(toMinorUnits(4.32))).toBe(4.32);
  });
});

describe("buildCalculationParams", () => {
  it("builds line items in minor units with the default tax code", () => {
    const params = buildCalculationParams(
      {
        currencyCode: "usd",
        destination,
        lineItems: [{ reference: "variant_1", amount: 19.99, quantity: 2 }],
        shippingAmount: 7.42,
      },
      options,
    );

    expect(params.currency).toBe("usd");
    expect(params.line_items).toEqual([
      {
        reference: "variant_1",
        amount: 1999,
        quantity: 2,
        tax_code: "txcd_99999999",
        tax_behavior: "exclusive",
      },
    ]);
    expect(params.shipping_cost).toEqual({
      amount: 742,
      tax_code: "txcd_92010001",
      tax_behavior: "exclusive",
    });
  });

  it("sends the destination as the customer's shipping address", () => {
    const params = buildCalculationParams(
      {
        currencyCode: "usd",
        destination,
        lineItems: [{ reference: "variant_1", amount: 10, quantity: 1 }],
        shippingAmount: 0,
      },
      options,
    );

    expect(params.customer_details?.address).toMatchObject({
      city: "Indianapolis",
      state: "IN",
      postal_code: "46201",
      country: "US",
    });
    expect(params.customer_details?.address_source).toBe("shipping");
  });
});

describe("normalizeCalculation", () => {
  it("converts the calculation's minor-unit tax amount to dollars", () => {
    const normalized = normalizeCalculation({
      id: "taxcalc_123",
      tax_amount_exclusive: 432,
      currency: "usd",
    } as never);

    expect(normalized).toEqual({
      calculationId: "taxcalc_123",
      taxAmount: 4.32,
      currencyCode: "usd",
    });
  });

  it("normalizes a zero-tax calculation", () => {
    const normalized = normalizeCalculation({
      id: "taxcalc_456",
      tax_amount_exclusive: 0,
      currency: "usd",
    } as never);

    expect(normalized.taxAmount).toBe(0);
  });
});

describe("taxCacheKey", () => {
  it("is stable regardless of line item order", () => {
    const base = {
      countryCode: "us",
      postalCode: "46201",
      state: "IN",
      city: "Indianapolis",
      currencyCode: "usd",
      shippingAmount: 7.42,
    };

    const a = taxCacheKey({
      ...base,
      lineItems: [
        { reference: "a", amount: 1, quantity: 1 },
        { reference: "b", amount: 2, quantity: 2 },
      ],
    });
    const b = taxCacheKey({
      ...base,
      lineItems: [
        { reference: "b", amount: 2, quantity: 2 },
        { reference: "a", amount: 1, quantity: 1 },
      ],
    });

    expect(a).toBe(b);
  });

  it("changes when the shipping amount changes", () => {
    const base = {
      countryCode: "us",
      postalCode: "46201",
      state: "IN",
      city: "Indianapolis",
      currencyCode: "usd",
      lineItems: [{ reference: "a", amount: 1, quantity: 1 }],
    };

    const a = taxCacheKey({ ...base, shippingAmount: 7.42 });
    const b = taxCacheKey({ ...base, shippingAmount: 0 });
    expect(a).not.toBe(b);
  });
});

describe("log tag", () => {
  it("is the literal alerting string", () => {
    expect(STRIPE_TAX_UNAVAILABLE_LOG_TAG).toBe("[stripe-tax:unavailable]");
  });
});
