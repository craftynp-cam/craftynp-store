import {
  priceSignature,
  signPriceQuote,
  verifyPriceQuote,
} from "./price-quote";

const SECRET = "price-quote-test-secret";

const LINE = { variantId: "variant_1", quantity: 50 };

function issue(overrides: Partial<Parameters<typeof signPriceQuote>[0]> = {}) {
  return signPriceQuote(
    {
      amt: 5.06,
      cur: "usd",
      ps: priceSignature(LINE),
      exp: Date.now() + 60_000,
      ...overrides,
    },
    SECRET,
  );
}

describe("priceSignature", () => {
  it("separates two quantities of the same variant", () => {
    expect(priceSignature(LINE)).not.toBe(
      priceSignature({ ...LINE, quantity: 100 }),
    );
  });

  it("separates two sizes of the same variant and quantity", () => {
    expect(
      priceSignature({ ...LINE, widthInches: 8, heightInches: 10 }),
    ).not.toBe(priceSignature({ ...LINE, widthInches: 10, heightInches: 8 }));
  });

  it("treats absent dimensions as different from given ones", () => {
    expect(priceSignature(LINE)).not.toBe(
      priceSignature({ ...LINE, widthInches: 8, heightInches: 10 }),
    );
  });
});

describe("verifyPriceQuote", () => {
  it("accepts a quote it issued for the same line", () => {
    const result = verifyPriceQuote(issue(), SECRET, {
      priceSignature: priceSignature(LINE),
    });

    expect(result).toEqual({
      valid: true,
      payload: expect.objectContaining({ v: 1, amt: 5.06, cur: "usd" }),
    });
  });

  it("refuses a quote replayed against a different quantity", () => {
    const result = verifyPriceQuote(issue(), SECRET, {
      priceSignature: priceSignature({ ...LINE, quantity: 100 }),
    });

    expect(result).toEqual({ valid: false, reason: "line_mismatch" });
  });

  it("refuses a quote signed with another secret", () => {
    const result = verifyPriceQuote(issue(), "a-different-secret", {
      priceSignature: priceSignature(LINE),
    });

    expect(result).toEqual({ valid: false, reason: "bad_signature" });
  });

  it("refuses a quote whose amount was edited in transit", () => {
    const [json, signature] = issue().split(".");
    const tampered = Buffer.from(
      JSON.stringify({
        v: 1,
        amt: 0.01,
        cur: "usd",
        ps: priceSignature(LINE),
        exp: Date.now() + 60_000,
      }),
      "utf8",
    )
      .toString("base64url")
      .replace(/=+$/, "");

    expect(json).not.toBe(tampered);
    const result = verifyPriceQuote(`${tampered}.${signature}`, SECRET, {
      priceSignature: priceSignature(LINE),
    });

    expect(result).toEqual({ valid: false, reason: "bad_signature" });
  });

  it("refuses an expired quote", () => {
    const result = verifyPriceQuote(issue({ exp: Date.now() - 1 }), SECRET, {
      priceSignature: priceSignature(LINE),
    });

    expect(result).toEqual({ valid: false, reason: "expired" });
  });

  it.each([
    ["a token with no signature", "not-a-token"],
    ["a token with too many parts", "a.b.c"],
  ])("refuses %s", (_label, token) => {
    expect(
      verifyPriceQuote(token, SECRET, { priceSignature: priceSignature(LINE) }),
    ).toEqual({ valid: false, reason: "malformed" });
  });
});
