import {
  checkoutAddressSchema,
  checkoutCompleteRequestSchema,
  checkoutCompleteResponseSchema,
  checkoutLineItemSchema,
  checkoutPrepareRequestSchema,
  checkoutPrepareResponseSchema,
} from "./checkout.js";

const validAddress = {
  firstName: "Ada",
  lastName: "Lovelace",
  phone: "5551234567",
  address1: "123 Craft Ln",
  address2: "",
  city: "Indianapolis",
  state: "IN",
  postalCode: "46201",
  countryCode: "us",
};

const validItem = { variantId: "variant_1", quantity: 2 };

describe("checkoutAddressSchema", () => {
  it("accepts a valid address", () => {
    expect(checkoutAddressSchema.safeParse(validAddress).success).toBe(true);
  });

  it("accepts a blank address2", () => {
    const result = checkoutAddressSchema.safeParse({
      ...validAddress,
      address2: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing first name", () => {
    const result = checkoutAddressSchema.safeParse({
      ...validAddress,
      firstName: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a country code that is not two letters", () => {
    const result = checkoutAddressSchema.safeParse({
      ...validAddress,
      countryCode: "usa",
    });
    expect(result.success).toBe(false);
  });
});

describe("checkoutLineItemSchema", () => {
  it("accepts a plain line item", () => {
    expect(checkoutLineItemSchema.safeParse(validItem).success).toBe(true);
  });

  it("accepts a customizable line item with details", () => {
    const result = checkoutLineItemSchema.safeParse({
      ...validItem,
      isCustomizable: true,
      details: [{ label: "Engraving", value: "Happy Birthday" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a zero quantity", () => {
    const result = checkoutLineItemSchema.safeParse({
      ...validItem,
      quantity: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe("checkoutPrepareRequestSchema", () => {
  const validRequest = {
    email: "ada@example.com",
    shippingAddress: validAddress,
    billingAddress: validAddress,
    items: [validItem],
    shippingRateId: "se-123",
    shippingServiceCode: "usps_ground_advantage",
    shippingQuoteToken: "token.signature",
    taxQuoteToken: "token.signature",
  };

  it("accepts a valid request without a cartId", () => {
    expect(checkoutPrepareRequestSchema.safeParse(validRequest).success).toBe(
      true,
    );
  });

  it("accepts a valid request with a cartId for idempotent replay", () => {
    const result = checkoutPrepareRequestSchema.safeParse({
      ...validRequest,
      cartId: "cart_123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = checkoutPrepareRequestSchema.safeParse({
      ...validRequest,
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty items array", () => {
    const result = checkoutPrepareRequestSchema.safeParse({
      ...validRequest,
      items: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing shipping quote token", () => {
    const result = checkoutPrepareRequestSchema.safeParse({
      ...validRequest,
      shippingQuoteToken: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing tax quote token", () => {
    const result = checkoutPrepareRequestSchema.safeParse({
      ...validRequest,
      taxQuoteToken: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("checkoutPrepareResponseSchema", () => {
  it("accepts a valid response", () => {
    const result = checkoutPrepareResponseSchema.safeParse({
      cartId: "cart_123",
      clientSecret: "pi_123_secret_abc",
      totals: {
        subtotal: 20,
        shipping: 7.42,
        tax: 1.65,
        total: 29.07,
        currencyCode: "usd",
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a negative total", () => {
    const result = checkoutPrepareResponseSchema.safeParse({
      cartId: "cart_123",
      clientSecret: "pi_123_secret_abc",
      totals: {
        subtotal: 20,
        shipping: 7.42,
        tax: 1.65,
        total: -1,
        currencyCode: "usd",
      },
    });
    expect(result.success).toBe(false);
  });
});

describe("checkoutCompleteRequestSchema", () => {
  it("accepts a valid request", () => {
    expect(
      checkoutCompleteRequestSchema.safeParse({ cartId: "cart_123" }).success,
    ).toBe(true);
  });

  it("rejects a missing cartId", () => {
    expect(checkoutCompleteRequestSchema.safeParse({}).success).toBe(false);
  });
});

describe("checkoutCompleteResponseSchema", () => {
  it("accepts a valid response", () => {
    const result = checkoutCompleteResponseSchema.safeParse({
      orderId: "order_123",
      displayId: 42,
      orderToken: "payload.signature",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a negative displayId", () => {
    const result = checkoutCompleteResponseSchema.safeParse({
      orderId: "order_123",
      displayId: -1,
      orderToken: "payload.signature",
    });
    expect(result.success).toBe(false);
  });
});
