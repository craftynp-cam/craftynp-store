import type { ShippingRate } from "@craftynp/types";

import {
  clearShippingRatesCache,
  readCachedShippingRates,
  readServerCachedShippingRates,
  SHIPPING_RATES_CACHE_KEY,
  writeCachedShippingRates,
} from "@/lib/shipping-rates-cache";

function makeRate(overrides: Partial<ShippingRate> = {}): ShippingRate {
  return {
    rateId: "rate_1",
    carrierName: "USPS",
    serviceName: "USPS Ground Advantage",
    serviceCode: "usps_ground_advantage",
    amount: 7.42,
    currencyCode: "usd",
    deliveryDays: 4,
    estimatedDeliveryDate: null,
    quoteToken: "token",
    ...overrides,
  };
}

describe("shipping rates cache", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("round-trips a written entry", () => {
    const rates = [makeRate()];
    writeCachedShippingRates("us|62704|a:1", rates);
    expect(readCachedShippingRates("us|62704|a:1")).toEqual(rates);
  });

  it("misses on a different key", () => {
    writeCachedShippingRates("us|62704|a:1", [makeRate()]);
    expect(readCachedShippingRates("us|95128|a:1")).toBeNull();
  });

  it("expires an entry past the TTL", () => {
    const now = Date.now();
    jest.spyOn(Date, "now").mockReturnValue(now);
    writeCachedShippingRates("us|62704|a:1", [makeRate()]);

    jest.spyOn(Date, "now").mockReturnValue(now + 16 * 60 * 1000);
    expect(readCachedShippingRates("us|62704|a:1")).toBeNull();

    jest.restoreAllMocks();
  });

  it("evicts the oldest entry past 5 keys", () => {
    for (let i = 0; i < 6; i += 1) {
      writeCachedShippingRates(`key-${i}`, [makeRate()]);
    }

    expect(readCachedShippingRates("key-0")).toBeNull();
    expect(readCachedShippingRates("key-5")).not.toBeNull();
  });

  it("swallows a sessionStorage read failure", () => {
    const getItem = jest
      .spyOn(window.sessionStorage.__proto__, "getItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });

    expect(() => readCachedShippingRates("us|62704|a:1")).not.toThrow();
    expect(readCachedShippingRates("us|62704|a:1")).toBeNull();

    getItem.mockRestore();
  });

  it("swallows a sessionStorage write failure", () => {
    const setItem = jest
      .spyOn(window.sessionStorage.__proto__, "setItem")
      .mockImplementation(() => {
        throw new Error("quota exceeded");
      });

    expect(() =>
      writeCachedShippingRates("us|62704|a:1", [makeRate()]),
    ).not.toThrow();

    setItem.mockRestore();
  });

  it("returns the same server snapshot every call", () => {
    expect(readServerCachedShippingRates()).toBe(
      readServerCachedShippingRates(),
    );
    expect(readServerCachedShippingRates()).toBeNull();
  });

  it("clears the stored cache", () => {
    writeCachedShippingRates("us|62704|a:1", [makeRate()]);
    clearShippingRatesCache();
    expect(window.sessionStorage.getItem(SHIPPING_RATES_CACHE_KEY)).toBeNull();
  });
});
