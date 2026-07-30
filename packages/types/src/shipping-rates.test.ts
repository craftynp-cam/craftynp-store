import {
  shippingRateRequestSchema,
  shippingRateSchema,
  shippingRatesResponseSchema,
} from "./shipping-rates.js";

const validDestination = {
  countryCode: "us",
  postalCode: "78756",
  city: "Austin",
  state: "TX",
};

const validRate = {
  rateId: "se-123",
  carrierName: "USPS",
  serviceName: "USPS Ground Advantage",
  serviceCode: "usps_ground_advantage",
  amount: 7.42,
  currencyCode: "usd",
  deliveryDays: 4,
  estimatedDeliveryDate: null,
  quoteToken: "token.signature",
};

describe("shippingRateRequestSchema", () => {
  it("accepts a valid request", () => {
    const result = shippingRateRequestSchema.safeParse({
      destination: validDestination,
      items: [{ variantId: "variant_1", quantity: 2 }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty items array", () => {
    const result = shippingRateRequestSchema.safeParse({
      destination: validDestination,
      items: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a zero quantity", () => {
    const result = shippingRateRequestSchema.safeParse({
      destination: validDestination,
      items: [{ variantId: "variant_1", quantity: 0 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-integer quantity", () => {
    const result = shippingRateRequestSchema.safeParse({
      destination: validDestination,
      items: [{ variantId: "variant_1", quantity: 1.5 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than 50 items", () => {
    const items = Array.from({ length: 51 }, (_, index) => ({
      variantId: `variant_${index}`,
      quantity: 1,
    }));
    const result = shippingRateRequestSchema.safeParse({
      destination: validDestination,
      items,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing postal code", () => {
    const result = shippingRateRequestSchema.safeParse({
      destination: { ...validDestination, postalCode: "" },
      items: [{ variantId: "variant_1", quantity: 1 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a country code that is not two letters", () => {
    const result = shippingRateRequestSchema.safeParse({
      destination: { ...validDestination, countryCode: "usa" },
      items: [{ variantId: "variant_1", quantity: 1 }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts an optional isResidential flag", () => {
    const result = shippingRateRequestSchema.safeParse({
      destination: { ...validDestination, isResidential: true },
      items: [{ variantId: "variant_1", quantity: 1 }],
    });
    expect(result.success).toBe(true);
  });
});

describe("shippingRateSchema", () => {
  it("accepts a live rate", () => {
    expect(shippingRateSchema.safeParse(validRate).success).toBe(true);
  });

  it("accepts a rate with null delivery fields", () => {
    const result = shippingRateSchema.safeParse({
      ...validRate,
      deliveryDays: null,
      estimatedDeliveryDate: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a negative amount", () => {
    const result = shippingRateSchema.safeParse({
      ...validRate,
      amount: -1,
    });
    expect(result.success).toBe(false);
  });
});

describe("shippingRatesResponseSchema", () => {
  it("round-trips a response with rates", () => {
    const result = shippingRatesResponseSchema.safeParse({
      rates: [validRate],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty rates array", () => {
    const result = shippingRatesResponseSchema.safeParse({
      rates: [],
    });
    expect(result.success).toBe(false);
  });
});
