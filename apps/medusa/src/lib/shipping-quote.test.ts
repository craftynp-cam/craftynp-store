import {
  cartSignature,
  signShippingQuote,
  verifyShippingQuote,
} from "./shipping-quote.js";

const secret = "test-secret";
const nowMs = Date.parse("2026-07-30T00:00:00.000Z");

const cart = {
  items: [{ variantId: "variant_1", quantity: 2 }],
  postalCode: "78756",
  countryCode: "us",
};

function issueToken(
  overrides: Partial<Parameters<typeof signShippingQuote>[0]> = {},
) {
  return signShippingQuote(
    {
      rid: "se-rate-1",
      amt: 7.42,
      cur: "usd",
      svc: "usps_ground_advantage",
      car: "usps",
      cs: cartSignature(cart),
      exp: nowMs + 30 * 60_000,
      ...overrides,
    },
    secret,
  );
}

describe("cartSignature", () => {
  it("is stable regardless of item order", () => {
    const a = cartSignature({
      items: [
        { variantId: "a", quantity: 1 },
        { variantId: "b", quantity: 2 },
      ],
      postalCode: "78756",
      countryCode: "us",
    });
    const b = cartSignature({
      items: [
        { variantId: "b", quantity: 2 },
        { variantId: "a", quantity: 1 },
      ],
      postalCode: "78756",
      countryCode: "us",
    });
    expect(a).toBe(b);
  });

  it("changes when a quantity changes", () => {
    const a = cartSignature(cart);
    const b = cartSignature({
      ...cart,
      items: [{ variantId: "variant_1", quantity: 3 }],
    });
    expect(a).not.toBe(b);
  });

  it("changes when the postal code changes", () => {
    const a = cartSignature(cart);
    const b = cartSignature({ ...cart, postalCode: "95128" });
    expect(a).not.toBe(b);
  });

  it("changes when the country changes", () => {
    const a = cartSignature(cart);
    const b = cartSignature({ ...cart, countryCode: "ca" });
    expect(a).not.toBe(b);
  });
});

describe("signShippingQuote / verifyShippingQuote", () => {
  it("round-trips a valid token", () => {
    const token = issueToken();
    const result = verifyShippingQuote(token, secret, {
      cartSignature: cartSignature(cart),
      nowMs,
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.payload.rid).toBe("se-rate-1");
      expect(result.payload.amt).toBe(7.42);
    }
  });

  it("rejects a tampered amount", () => {
    const token = issueToken();
    const [json, signature] = token.split(".");
    const decoded = JSON.parse(
      Buffer.from(
        json!.replace(/-/g, "+").replace(/_/g, "/"),
        "base64",
      ).toString("utf8"),
    );
    decoded.amt = 0.01;
    const tamperedJson = Buffer.from(JSON.stringify(decoded))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const tamperedToken = `${tamperedJson}.${signature}`;

    const result = verifyShippingQuote(tamperedToken, secret, {
      cartSignature: cartSignature(cart),
      nowMs,
    });
    expect(result).toEqual({ valid: false, reason: "bad_signature" });
  });

  it("rejects a malformed token", () => {
    const result = verifyShippingQuote("not-a-token", secret, {
      cartSignature: cartSignature(cart),
      nowMs,
    });
    expect(result).toEqual({ valid: false, reason: "malformed" });
  });

  it("rejects an expired token", () => {
    const token = issueToken({ exp: nowMs - 1000 });
    const result = verifyShippingQuote(token, secret, {
      cartSignature: cartSignature(cart),
      nowMs,
    });
    expect(result).toEqual({ valid: false, reason: "expired" });
  });

  it("rejects a cart signature mismatch", () => {
    const token = issueToken();
    const result = verifyShippingQuote(token, secret, {
      cartSignature: cartSignature({ ...cart, postalCode: "95128" }),
      nowMs,
    });
    expect(result).toEqual({ valid: false, reason: "cart_mismatch" });
  });

  it("rejects a token signed with the wrong secret", () => {
    const token = issueToken();
    const result = verifyShippingQuote(token, "wrong-secret", {
      cartSignature: cartSignature(cart),
      nowMs,
    });
    expect(result).toEqual({ valid: false, reason: "bad_signature" });
  });
});
