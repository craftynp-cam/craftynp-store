import {
  checkoutAddressSchema,
  checkoutCompleteRequestSchema,
  checkoutCompleteResponseSchema,
  checkoutLineItemSchema,
  checkoutPrepareRequestSchema,
  checkoutPrepareResponseSchema,
  formatCheckoutLineRefusals,
  parseCheckoutLineRefusals,
  type CheckoutLineRefusal,
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

  it("accepts eight details at the label and value caps", () => {
    const result = checkoutLineItemSchema.safeParse({
      ...validItem,
      details: Array.from({ length: 8 }, () => ({
        label: "L".repeat(64),
        value: "v".repeat(1000),
      })),
    });
    expect(result.success).toBe(true);
  });

  it.each([
    ["a label over 64 characters", [{ label: "L".repeat(65), value: "Ellie" }]],
    [
      "a value over 1,000 characters",
      [{ label: "Custom text", value: "v".repeat(1001) }],
    ],
    [
      "more than eight rows",
      Array.from({ length: 9 }, (_, index) => ({
        label: `Row ${index}`,
        value: "Ellie",
      })),
    ],
  ])("rejects details with %s", (_label, details) => {
    expect(
      checkoutLineItemSchema.safeParse({ ...validItem, details }).success,
    ).toBe(false);
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

describe("checkout line refusals", () => {
  const refusals: CheckoutLineRefusal[] = [
    { error: "invalid_customization", reason: "artwork_not_found", line: 0 },
    {
      error: "invalid_customization",
      reason: "missing_required",
      input: "dimensions",
      line: 2,
    },
    { error: "invalid_price_quote", reason: "expired", line: 3 },
  ];

  it("reads back every refused line it wrote, with its input key", () => {
    const message = formatCheckoutLineRefusals(refusals);

    expect(message).toBe(
      "invalid_customization:artwork_not_found@0,invalid_customization:missing_required:dimensions@2,invalid_price_quote:expired@3",
    );
    expect(parseCheckoutLineRefusals(message)).toEqual(refusals);
  });

  it("reads an input key the registry spells in camelCase", () => {
    expect(
      parseCheckoutLineRefusals(
        "invalid_customization:missing_required:customText@0,invalid_customization:input_off:orderNotes@1",
      ),
    ).toEqual([
      {
        error: "invalid_customization",
        reason: "missing_required",
        input: "customText",
        line: 0,
      },
      {
        error: "invalid_customization",
        reason: "input_off",
        input: "orderNotes",
        line: 1,
      },
    ]);
  });

  it("carries free-text detail after the head without disturbing the parse", () => {
    const message = formatCheckoutLineRefusals([
      {
        error: "invalid_customization",
        reason: "rejected",
        line: 1,
        detail:
          "Invalid line item customization — artwork: needs 300 DPI; got 12",
      },
    ]);

    expect(message).toContain("300 DPI");
    expect(parseCheckoutLineRefusals(message)).toEqual([
      { error: "invalid_customization", reason: "rejected", line: 1 },
    ]);
  });

  it.each([
    ["an older Medusa's message with no line", "invalid_price_quote:expired"],
    ["a refusal that is not about a line", "invalid_tax_quote:expired@0"],
    [
      "a reason the storefront has no words for",
      "invalid_price_quote:haggled@0",
    ],
    [
      "an input on a reason that names none",
      "invalid_customization:artwork_not_found:artwork@0",
    ],
    [
      "a required-input refusal that names no input",
      "invalid_customization:missing_required@0",
    ],
    [
      "an input key the registry does not declare",
      "invalid_customization:input_off:engraving@0",
    ],
    [
      "one malformed entry among good ones",
      "invalid_price_quote:expired@0,oops",
    ],
    [
      "a validator's free text",
      "Invalid request: Expected type: 'string' for field 'items, 0, customization'",
    ],
    ["an empty message", ""],
  ])("does not read %s as a line refusal", (_case, message) => {
    expect(parseCheckoutLineRefusals(message)).toBeNull();
  });
});
