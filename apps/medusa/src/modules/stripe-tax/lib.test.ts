import {
  STRIPE_TAX_UNAVAILABLE_LOG_TAG,
  amountToRate,
  buildCalculationParams,
  buildProviderCalculationInput,
  fromMinorUnits,
  normalizeCalculation,
  normalizeProviderCalculation,
  taxCacheKey,
  toMinorUnits,
  toStripeTaxError,
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

describe("amountToRate", () => {
  it("converts a tax amount to a percentage of the base amount", () => {
    // $7.25 tax on $100 is a 7.25% rate.
    expect(amountToRate(725, 10000)).toBe(7.25);
  });

  it("returns zero for a zero base amount rather than dividing by zero", () => {
    expect(amountToRate(0, 0)).toBe(0);
  });

  it("returns zero when there is no tax obligation", () => {
    expect(amountToRate(0, 10000)).toBe(0);
  });

  it("rounds to four decimal places of percentage precision", () => {
    expect(amountToRate(1, 3)).toBeCloseTo(33.3333, 4);
  });
});

describe("buildProviderCalculationInput", () => {
  const address = {
    countryCode: "us",
    postalCode: "46201",
    city: "Indianapolis",
    provinceCode: "IN",
  };

  it("maps item and shipping lines into a calculation input", () => {
    const input = buildProviderCalculationInput(
      [{ id: "item_1", unitPrice: 19.99, quantity: 2, currencyCode: "usd" }],
      [{ unitPrice: 7.42, currencyCode: "usd" }],
      address,
    );

    expect(input.currencyCode).toBe("usd");
    expect(input.lineItems).toEqual([
      { reference: "item_1", amount: 19.99, quantity: 2 },
    ]);
    expect(input.shippingAmount).toBe(7.42);
    expect(input.destination).toEqual({
      countryCode: "us",
      postalCode: "46201",
      city: "Indianapolis",
      state: "IN",
    });
  });

  it("sums multiple shipping lines", () => {
    const input = buildProviderCalculationInput(
      [],
      [
        { unitPrice: 5, currencyCode: "usd" },
        { unitPrice: 2.5, currencyCode: "usd" },
      ],
      address,
    );

    expect(input.shippingAmount).toBe(7.5);
  });

  it("falls back to usd when no line carries a currency code", () => {
    const input = buildProviderCalculationInput([], [], address);
    expect(input.currencyCode).toBe("usd");
  });
});

describe("normalizeProviderCalculation", () => {
  it("converts each expanded line item into a per-line rate", () => {
    const normalized = normalizeProviderCalculation({
      id: "taxcalc_123",
      currency: "usd",
      line_items: {
        data: [
          { reference: "item_1", amount: 1000, amount_tax: 72 },
          { reference: "item_2", amount: 2000, amount_tax: 144 },
        ],
      },
      shipping_cost: { amount: 742, amount_tax: 53 },
    } as never);

    expect(normalized.calculationId).toBe("taxcalc_123");
    expect(normalized.itemRates).toEqual([
      { reference: "item_1", rate: 7.2 },
      { reference: "item_2", rate: 7.2 },
    ]);
    expect(normalized.shippingRate).toBeCloseTo(7.1429, 4);
  });

  it("returns a zero shipping rate when there is no shipping cost", () => {
    const normalized = normalizeProviderCalculation({
      id: "taxcalc_456",
      currency: "usd",
      line_items: { data: [] },
      shipping_cost: null,
    } as never);

    expect(normalized.shippingRate).toBe(0);
  });

  it("returns an empty item rate list when line_items was not expanded", () => {
    const normalized = normalizeProviderCalculation({
      id: "taxcalc_789",
      currency: "usd",
      line_items: null,
      shipping_cost: null,
    } as never);

    expect(normalized.itemRates).toEqual([]);
  });
});

describe("toStripeTaxError", () => {
  it("wraps a non-Stripe error as an http_error", () => {
    const error = toStripeTaxError(new Error("boom"));
    expect(error.reason).toBe("http_error");
    expect(error.message).toBe("boom");
  });

  it("wraps a non-Error value", () => {
    const error = toStripeTaxError("boom");
    expect(error.reason).toBe("http_error");
    expect(error.message).toBe("boom");
  });
});
