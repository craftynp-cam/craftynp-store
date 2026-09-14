import {
  PRICE_QUOTE_REFRESH_MARGIN_MS,
  needsFreshPriceQuote,
} from "@/lib/price-quote";

const NOW = Date.UTC(2026, 8, 13, 12);
const dimensions = { widthInches: 8, heightInches: 10 };

function token(payload: unknown): string {
  const segment = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${segment}.signature`;
}

function areaLine(priceQuoteToken: string | undefined) {
  return { priceQuoteToken, customization: { dimensions } };
}

describe("needsFreshPriceQuote", () => {
  it("keeps a token that outlives the refresh margin, however its payload encodes", () => {
    const fresh = token({
      v: 1,
      ps: "???>>>",
      exp: NOW + PRICE_QUOTE_REFRESH_MARGIN_MS + 1_000,
    });

    expect(fresh).toMatch(/[-_]/);
    expect(needsFreshPriceQuote(areaLine(fresh), NOW)).toBe(false);
  });

  it.each([
    ["has no token", undefined],
    ["has an expired token", token({ v: 1, exp: NOW - 1 })],
    [
      "has a token expiring inside the margin",
      token({ v: 1, exp: NOW + PRICE_QUOTE_REFRESH_MARGIN_MS - 1 }),
    ],
    ["has a token with no signature segment", "just-one-segment"],
    ["has a token that is not JSON", "bm90IGpzb24.signature"],
    ["has a token with no numeric expiry", token({ v: 1, exp: "soon" })],
  ])("re-quotes an area-priced line that %s", (_case, priceQuoteToken) => {
    expect(needsFreshPriceQuote(areaLine(priceQuoteToken), NOW)).toBe(true);
  });

  it("never re-quotes a line Medusa prices itself", () => {
    expect(needsFreshPriceQuote({ priceQuoteToken: undefined }, NOW)).toBe(
      false,
    );
  });
});
