import {
  clearTaxQuoteCache,
  readCachedTaxQuote,
  readServerCachedTaxQuote,
  TAX_QUOTE_CACHE_KEY,
  writeCachedTaxQuote,
  type CachedTaxQuote,
} from "@/lib/tax-quote-cache";

function makeQuote(overrides: Partial<CachedTaxQuote> = {}): CachedTaxQuote {
  return {
    taxAmount: 4.32,
    currencyCode: "usd",
    quoteToken: "token.signature",
    ...overrides,
  };
}

describe("tax quote cache", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("round-trips a written entry", () => {
    const quote = makeQuote();
    writeCachedTaxQuote("us|62704|il|springfield|rate_1|a:1", quote);
    expect(
      readCachedTaxQuote("us|62704|il|springfield|rate_1|a:1"),
    ).toEqual(quote);
  });

  it("misses on a different key", () => {
    writeCachedTaxQuote("us|62704|il|springfield|rate_1|a:1", makeQuote());
    expect(
      readCachedTaxQuote("us|95128|ca|san jose|rate_2|a:1"),
    ).toBeNull();
  });

  it("expires an entry past the TTL", () => {
    const now = Date.now();
    jest.spyOn(Date, "now").mockReturnValue(now);
    writeCachedTaxQuote("us|62704|il|springfield|rate_1|a:1", makeQuote());

    jest.spyOn(Date, "now").mockReturnValue(now + 16 * 60 * 1000);
    expect(
      readCachedTaxQuote("us|62704|il|springfield|rate_1|a:1"),
    ).toBeNull();

    jest.restoreAllMocks();
  });

  it("evicts the oldest entry past 5 keys", () => {
    for (let i = 0; i < 6; i += 1) {
      writeCachedTaxQuote(`key-${i}`, makeQuote());
    }

    expect(readCachedTaxQuote("key-0")).toBeNull();
    expect(readCachedTaxQuote("key-5")).not.toBeNull();
  });

  it("swallows a sessionStorage read failure", () => {
    const getItem = jest
      .spyOn(window.sessionStorage.__proto__, "getItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });

    expect(() =>
      readCachedTaxQuote("us|62704|il|springfield|rate_1|a:1"),
    ).not.toThrow();
    expect(
      readCachedTaxQuote("us|62704|il|springfield|rate_1|a:1"),
    ).toBeNull();

    getItem.mockRestore();
  });

  it("swallows a sessionStorage write failure", () => {
    const setItem = jest
      .spyOn(window.sessionStorage.__proto__, "setItem")
      .mockImplementation(() => {
        throw new Error("quota exceeded");
      });

    expect(() =>
      writeCachedTaxQuote("us|62704|il|springfield|rate_1|a:1", makeQuote()),
    ).not.toThrow();

    setItem.mockRestore();
  });

  it("returns the same server snapshot every call", () => {
    expect(readServerCachedTaxQuote()).toBe(readServerCachedTaxQuote());
    expect(readServerCachedTaxQuote()).toBeNull();
  });

  it("clears the stored cache", () => {
    writeCachedTaxQuote("us|62704|il|springfield|rate_1|a:1", makeQuote());
    clearTaxQuoteCache();
    expect(window.sessionStorage.getItem(TAX_QUOTE_CACHE_KEY)).toBeNull();
  });
});
