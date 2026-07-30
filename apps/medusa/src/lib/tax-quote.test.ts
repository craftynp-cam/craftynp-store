import { signTaxQuote, taxSignature, verifyTaxQuote } from "./tax-quote.js";

const secret = "test-secret";
const nowMs = Date.parse("2026-07-30T00:00:00.000Z");

const cart = {
  items: [{ variantId: "variant_1", quantity: 2 }],
  postalCode: "46201",
  countryCode: "us",
  state: "IN",
  city: "Indianapolis",
  shippingAmount: 7.42,
};

function issueToken(
  overrides: Partial<Parameters<typeof signTaxQuote>[0]> = {},
) {
  return signTaxQuote(
    {
      cid: "taxcalc_1",
      amt: 4.32,
      cur: "usd",
      ts: taxSignature(cart),
      exp: nowMs + 30 * 60_000,
      ...overrides,
    },
    secret,
  );
}

describe("taxSignature", () => {
  it("is stable regardless of item order", () => {
    const a = taxSignature({
      ...cart,
      items: [
        { variantId: "a", quantity: 1 },
        { variantId: "b", quantity: 2 },
      ],
    });
    const b = taxSignature({
      ...cart,
      items: [
        { variantId: "b", quantity: 2 },
        { variantId: "a", quantity: 1 },
      ],
    });
    expect(a).toBe(b);
  });

  it("changes when a quantity changes", () => {
    const a = taxSignature(cart);
    const b = taxSignature({
      ...cart,
      items: [{ variantId: "variant_1", quantity: 3 }],
    });
    expect(a).not.toBe(b);
  });

  it("changes when the postal code changes", () => {
    const a = taxSignature(cart);
    const b = taxSignature({ ...cart, postalCode: "95128" });
    expect(a).not.toBe(b);
  });

  it("changes when the state changes", () => {
    const a = taxSignature(cart);
    const b = taxSignature({ ...cart, state: "CA" });
    expect(a).not.toBe(b);
  });

  it("changes when the shipping amount changes", () => {
    const a = taxSignature(cart);
    const b = taxSignature({ ...cart, shippingAmount: 0 });
    expect(a).not.toBe(b);
  });
});

describe("signTaxQuote / verifyTaxQuote", () => {
  it("round-trips a valid token", () => {
    const token = issueToken();
    const result = verifyTaxQuote(token, secret, {
      taxSignature: taxSignature(cart),
      nowMs,
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.payload.cid).toBe("taxcalc_1");
      expect(result.payload.amt).toBe(4.32);
    }
  });

  it("accepts a zero tax amount", () => {
    const token = issueToken({ amt: 0 });
    const result = verifyTaxQuote(token, secret, {
      taxSignature: taxSignature(cart),
      nowMs,
    });
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.payload.amt).toBe(0);
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

    const result = verifyTaxQuote(tamperedToken, secret, {
      taxSignature: taxSignature(cart),
      nowMs,
    });
    expect(result).toEqual({ valid: false, reason: "bad_signature" });
  });

  it("rejects a malformed token", () => {
    const result = verifyTaxQuote("not-a-token", secret, {
      taxSignature: taxSignature(cart),
      nowMs,
    });
    expect(result).toEqual({ valid: false, reason: "malformed" });
  });

  it("rejects an expired token", () => {
    const token = issueToken({ exp: nowMs - 1000 });
    const result = verifyTaxQuote(token, secret, {
      taxSignature: taxSignature(cart),
      nowMs,
    });
    expect(result).toEqual({ valid: false, reason: "expired" });
  });

  it("rejects a tax signature mismatch", () => {
    const token = issueToken();
    const result = verifyTaxQuote(token, secret, {
      taxSignature: taxSignature({ ...cart, postalCode: "95128" }),
      nowMs,
    });
    expect(result).toEqual({ valid: false, reason: "cart_mismatch" });
  });

  it("rejects a token signed with the wrong secret", () => {
    const token = issueToken();
    const result = verifyTaxQuote(token, "wrong-secret", {
      taxSignature: taxSignature(cart),
      nowMs,
    });
    expect(result).toEqual({ valid: false, reason: "bad_signature" });
  });
});
