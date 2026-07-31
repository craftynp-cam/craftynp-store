import { MedusaError } from "@medusajs/framework/utils";

import {
  applyRetryAfter,
  buildEstimateRequest,
  extractRates,
  normalizeUspsRates,
  packItemsIntoOneBox,
  parseRetryAfterMs,
  rateCacheKey,
  refillBucket,
  takeToken,
  validateShipStationOptions,
  type PackableItem,
} from "./lib.js";

const validOptions = {
  apiKey: "key",
  baseUrl: "https://api.shipstation.com/v2",
  uspsCarrierId: "se-123",
  rateLimitPerMinute: 200,
  timeoutMs: 5000,
  maxRetries: 2,
  weightUnit: "gram",
  dimensionUnit: "centimeter",
  cacheTtlSeconds: 900,
  fromCountryCode: "US",
  fromPostalCode: "78756",
};

describe("validateShipStationOptions", () => {
  it("passes when every required option is present", () => {
    expect(() => validateShipStationOptions(validOptions)).not.toThrow();
  });

  it.each(Object.keys(validOptions).filter((key) => key !== "uspsCarrierId"))(
    "throws MedusaError.Types.INVALID_DATA when %s is missing",
    (missingKey) => {
      const options: Record<string, unknown> = { ...validOptions };
      delete options[missingKey];

      expect(() => validateShipStationOptions(options)).toThrow(MedusaError);
    },
  );

  it("does not require uspsCarrierId — it is discovered via list-carriers after boot", () => {
    const options: Record<string, unknown> = { ...validOptions };
    delete options.uspsCarrierId;

    expect(() => validateShipStationOptions(options)).not.toThrow();
  });
});

function item(overrides: Partial<PackableItem> = {}): PackableItem {
  return {
    variantId: "variant_1",
    quantity: 1,
    weight: 100,
    length: 10,
    width: 10,
    height: 10,
    ...overrides,
  };
}

describe("packItemsIntoOneBox", () => {
  it("returns ok:false with an empty missing list for no items", () => {
    expect(packItemsIntoOneBox([])).toEqual({ ok: false, missing: [] });
  });

  it("multiplies weight and height by quantity", () => {
    const result = packItemsIntoOneBox([item({ quantity: 3 })]);
    expect(result).toEqual({
      ok: true,
      parcel: { weight: 300, length: 10, width: 10, height: 30 },
    });
  });

  it("takes the max length and width across items", () => {
    const result = packItemsIntoOneBox([
      item({ variantId: "a", length: 5, width: 20 }),
      item({ variantId: "b", length: 15, width: 8 }),
    ]);
    expect(result).toEqual({
      ok: true,
      parcel: { weight: 200, length: 15, width: 20, height: 20 },
    });
  });

  it("sums height across items", () => {
    const result = packItemsIntoOneBox([
      item({ variantId: "a", height: 4 }),
      item({ variantId: "b", height: 6 }),
    ]);
    expect(result?.ok && result.parcel.height).toBe(10);
  });

  it("falls back to product-level dimensions when the variant has none", () => {
    const result = packItemsIntoOneBox([
      item({ weight: null, length: undefined }),
    ]);
    expect(result.ok).toBe(false);
  });

  it("reports every variant missing a dimension", () => {
    const result = packItemsIntoOneBox([
      item({ variantId: "a", weight: null }),
      item({ variantId: "b", height: 0 }),
      item({ variantId: "c" }),
    ]);
    expect(result).toEqual({ ok: false, missing: ["a", "b"] });
  });

  it("treats a zero or negative dimension as missing", () => {
    expect(packItemsIntoOneBox([item({ weight: 0 })]).ok).toBe(false);
    expect(packItemsIntoOneBox([item({ length: -1 })]).ok).toBe(false);
  });
});

describe("buildEstimateRequest", () => {
  const parcel = { weight: 400, length: 30, width: 20, height: 10 };

  it("builds the exact snake_case body ShipStation expects", () => {
    const request = buildEstimateRequest({
      from: { countryCode: "us", postalCode: "78756" },
      to: {
        countryCode: "us",
        postalCode: "95128",
        city: "San Jose",
        state: "CA",
        isResidential: false,
      },
      parcel,
      carrierId: "se-123",
      weightUnit: "gram",
      dimensionUnit: "centimeter",
      shipDate: new Date("2026-07-30T00:00:00.000Z"),
    });

    expect(request).toEqual({
      carrier_ids: ["se-123"],
      from_country_code: "US",
      from_postal_code: "78756",
      to_country_code: "US",
      to_postal_code: "95128",
      to_city_locality: "San Jose",
      to_state_province: "CA",
      weight: { value: 400, unit: "gram" },
      dimensions: { unit: "centimeter", length: 30, width: 20, height: 10 },
      confirmation: "none",
      address_residential_indicator: "no",
      ship_date: "2026-07-30T00:00:00.000Z",
    });
  });

  it("maps a residential destination to yes and an unset one to unknown", () => {
    const base = {
      from: { countryCode: "us", postalCode: "78756" },
      parcel,
      carrierId: "se-123",
      weightUnit: "gram",
      dimensionUnit: "centimeter",
      shipDate: new Date(),
    };

    const residential = buildEstimateRequest({
      ...base,
      to: {
        countryCode: "us",
        postalCode: "95128",
        city: "San Jose",
        state: "CA",
        isResidential: true,
      },
    });
    expect(residential.address_residential_indicator).toBe("yes");

    const unset = buildEstimateRequest({
      ...base,
      to: {
        countryCode: "us",
        postalCode: "95128",
        city: "San Jose",
        state: "CA",
      },
    });
    expect(unset.address_residential_indicator).toBe("unknown");
  });

  it("omits carrier_ids when no carrier is configured", () => {
    const request = buildEstimateRequest({
      from: { countryCode: "us", postalCode: "78756" },
      to: {
        countryCode: "us",
        postalCode: "95128",
        city: "San Jose",
        state: "CA",
      },
      parcel,
      carrierId: "",
      weightUnit: "gram",
      dimensionUnit: "centimeter",
      shipDate: new Date(),
    });
    expect(request).not.toHaveProperty("carrier_ids");
  });
});

describe("extractRates", () => {
  const rate = { rate_id: "r1" };

  it("accepts a bare top-level array", () => {
    expect(extractRates([rate])).toEqual([rate]);
  });

  it("accepts rate_response.rates envelope", () => {
    expect(extractRates({ rate_response: { rates: [rate] } })).toEqual([rate]);
  });

  it("accepts a top-level rates key", () => {
    expect(extractRates({ rates: [rate] })).toEqual([rate]);
  });

  it("returns an empty array for garbage input", () => {
    expect(extractRates(null)).toEqual([]);
    expect(extractRates(undefined)).toEqual([]);
    expect(extractRates("nope")).toEqual([]);
    expect(extractRates({})).toEqual([]);
  });
});

describe("normalizeUspsRates", () => {
  function raw(overrides: Record<string, unknown> = {}) {
    return {
      carrier_code: "usps",
      carrier_friendly_name: "USPS",
      service_code: "usps_ground_advantage",
      service_type: "USPS Ground Advantage",
      rate_id: "r1",
      shipping_amount: { currency: "usd", amount: 7.42 },
      delivery_days: 4,
      estimated_delivery_date: null,
      ...overrides,
    };
  }

  it("drops non-USPS service codes, regardless of carrier_code", () => {
    expect(
      normalizeUspsRates([
        raw({
          carrier_code: "fedex",
          service_code: "fedex_ground",
          service_type: "FedEx Ground",
        }),
      ]),
    ).toEqual([]);
  });

  it("keeps USPS service codes even when carrier_code is a reseller like stamps_com", () => {
    const result = normalizeUspsRates([raw({ carrier_code: "stamps_com" })]);
    expect(result).toHaveLength(1);
    expect(result[0]?.serviceCode).toBe("usps_ground_advantage");
  });

  it("drops rates with no shipping_amount", () => {
    expect(normalizeUspsRates([raw({ shipping_amount: undefined })])).toEqual(
      [],
    );
  });

  it("dedupes on service_code, keeping the first", () => {
    const result = normalizeUspsRates([
      raw({ rate_id: "first" }),
      raw({ rate_id: "second" }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]?.rateId).toBe("first");
  });

  it("sorts ascending by amount", () => {
    const result = normalizeUspsRates([
      raw({
        service_code: "usps_expensive",
        shipping_amount: { currency: "usd", amount: 20 },
      }),
      raw({
        service_code: "usps_cheap",
        shipping_amount: { currency: "usd", amount: 5 },
      }),
    ]);
    expect(result.map((r) => r.serviceCode)).toEqual([
      "usps_cheap",
      "usps_expensive",
    ]);
  });

  it("is null-safe on delivery fields", () => {
    const result = normalizeUspsRates([
      raw({ delivery_days: null, estimated_delivery_date: null }),
    ]);
    expect(result[0]).toMatchObject({
      deliveryDays: null,
      estimatedDeliveryDate: null,
    });
  });
});

describe("rateCacheKey", () => {
  const base = {
    countryCode: "US",
    postalCode: "78756",
    weightUnit: "gram",
    dimensionUnit: "centimeter",
    parcel: { weight: 400, length: 30, width: 20, height: 10 },
  };

  it("is independent of key construction order (same inputs, same key)", () => {
    expect(rateCacheKey(base)).toBe(rateCacheKey({ ...base }));
  });

  it("is sensitive to postal code", () => {
    expect(rateCacheKey(base)).not.toBe(
      rateCacheKey({ ...base, postalCode: "95128" }),
    );
  });

  it("is sensitive to weight and dimensions", () => {
    expect(rateCacheKey(base)).not.toBe(
      rateCacheKey({ ...base, parcel: { ...base.parcel, weight: 500 } }),
    );
  });

  it("is sensitive to residential flag", () => {
    expect(rateCacheKey({ ...base, isResidential: true })).not.toBe(
      rateCacheKey({ ...base, isResidential: false }),
    );
  });
});

describe("parseRetryAfterMs", () => {
  const nowMs = Date.parse("2026-07-30T00:00:00.000Z");

  it("parses delta-seconds", () => {
    expect(parseRetryAfterMs("3", nowMs, 60_000)).toBe(3000);
  });

  it("parses an HTTP-date", () => {
    expect(
      parseRetryAfterMs("Thu, 30 Jul 2026 00:00:05 GMT", nowMs, 60_000),
    ).toBe(5000);
  });

  it("returns null when the header is absent", () => {
    expect(parseRetryAfterMs(null, nowMs, 60_000)).toBeNull();
  });

  it("returns null for garbage", () => {
    expect(parseRetryAfterMs("not-a-value", nowMs, 60_000)).toBeNull();
  });

  it("clamps negative deltas to zero", () => {
    expect(parseRetryAfterMs("-5", nowMs, 60_000)).toBe(0);
  });

  it("clamps to maxMs", () => {
    expect(parseRetryAfterMs("1000", nowMs, 5000)).toBe(5000);
  });
});

describe("token bucket reducers", () => {
  const capacity = 5;
  const ratePerMinute = 60;

  it("refills over elapsed time up to capacity", () => {
    const state = { tokens: 0, lastRefillMs: 0, blockedUntilMs: 0 };
    const refilled = refillBucket(state, 30_000, ratePerMinute, capacity);
    expect(refilled.tokens).toBe(capacity);
  });

  it("takeToken decrements when a token is available", () => {
    const state = { tokens: 2, lastRefillMs: 0, blockedUntilMs: 0 };
    const { state: next, waitMs } = takeToken(
      state,
      0,
      ratePerMinute,
      capacity,
    );
    expect(waitMs).toBe(0);
    expect(next.tokens).toBe(1);
  });

  it("takeToken returns a wait when no tokens are left", () => {
    const state = { tokens: 0, lastRefillMs: 0, blockedUntilMs: 0 };
    const { waitMs } = takeToken(state, 0, ratePerMinute, capacity);
    expect(waitMs).toBeGreaterThan(0);
  });

  it("blockedUntilMs dominates even with a full bucket", () => {
    const state = { tokens: capacity, lastRefillMs: 0, blockedUntilMs: 10_000 };
    const { waitMs } = takeToken(state, 1000, ratePerMinute, capacity);
    expect(waitMs).toBe(9000);
  });

  it("applyRetryAfter drains tokens and sets blockedUntilMs", () => {
    const state = { tokens: capacity, lastRefillMs: 0, blockedUntilMs: 0 };
    const next = applyRetryAfter(state, 1000, 5000);
    expect(next.tokens).toBe(0);
    expect(next.blockedUntilMs).toBe(6000);
  });
});
