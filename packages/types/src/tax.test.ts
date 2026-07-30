import { taxQuoteRequestSchema, taxQuoteResponseSchema } from "./tax.js";

const validDestination = {
  countryCode: "us",
  postalCode: "46201",
  city: "Indianapolis",
  state: "IN",
};

describe("taxQuoteRequestSchema", () => {
  it("accepts a valid request", () => {
    const result = taxQuoteRequestSchema.safeParse({
      destination: validDestination,
      items: [{ variantId: "variant_1", quantity: 2 }],
      shippingQuoteToken: "token.signature",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty items array", () => {
    const result = taxQuoteRequestSchema.safeParse({
      destination: validDestination,
      items: [],
      shippingQuoteToken: "token.signature",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing shipping quote token", () => {
    const result = taxQuoteRequestSchema.safeParse({
      destination: validDestination,
      items: [{ variantId: "variant_1", quantity: 1 }],
      shippingQuoteToken: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than 50 items", () => {
    const items = Array.from({ length: 51 }, (_, index) => ({
      variantId: `variant_${index}`,
      quantity: 1,
    }));
    const result = taxQuoteRequestSchema.safeParse({
      destination: validDestination,
      items,
      shippingQuoteToken: "token.signature",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a country code that is not two letters", () => {
    const result = taxQuoteRequestSchema.safeParse({
      destination: { ...validDestination, countryCode: "usa" },
      items: [{ variantId: "variant_1", quantity: 1 }],
      shippingQuoteToken: "token.signature",
    });
    expect(result.success).toBe(false);
  });
});

describe("taxQuoteResponseSchema", () => {
  it("accepts a non-zero tax amount", () => {
    const result = taxQuoteResponseSchema.safeParse({
      taxAmount: 4.32,
      currencyCode: "usd",
      quoteToken: "token.signature",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a zero tax amount for a state with no obligation", () => {
    const result = taxQuoteResponseSchema.safeParse({
      taxAmount: 0,
      currencyCode: "usd",
      quoteToken: "token.signature",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a negative tax amount", () => {
    const result = taxQuoteResponseSchema.safeParse({
      taxAmount: -1,
      currencyCode: "usd",
      quoteToken: "token.signature",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing quote token", () => {
    const result = taxQuoteResponseSchema.safeParse({
      taxAmount: 1,
      currencyCode: "usd",
      quoteToken: "",
    });
    expect(result.success).toBe(false);
  });
});
