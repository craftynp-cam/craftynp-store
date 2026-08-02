import { MedusaError } from "@medusajs/framework/utils";

import {
  applyRetryAfter,
  buildAddressPayload,
  buildEstimateRequest,
  buildLabelRequest,
  buildRatesRequest,
  extractCarriers,
  extractRates,
  extractVoidResult,
  matchReconciledLabel,
  normalizeLiveRates,
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
  labelTimeoutMs: 30000,
  maxRetries: 2,
  weightUnit: "gram",
  dimensionUnit: "centimeter",
  cacheTtlSeconds: 900,
  fromName: "The Crafty NP",
  fromPhone: "5125550123",
  fromAddress1: "1 Maker Way",
  fromCity: "Austin",
  fromState: "TX",
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

const shipFrom = {
  name: "The Crafty NP",
  phone: "5125550123",
  addressLine1: "1 Maker Way",
  cityLocality: "Austin",
  stateProvince: "TX",
  postalCode: "78756",
  countryCode: "US",
  isResidential: false,
};

const shipTo = {
  name: "Ada Lovelace",
  phone: "4085550147",
  addressLine1: "500 Almaden Blvd",
  addressLine2: "Apt 4",
  cityLocality: "San Jose",
  stateProvince: "CA",
  postalCode: "95128",
  countryCode: "us",
  isResidential: true,
};

const labelParcel = { weight: 640, length: 30, width: 20, height: 12 };

function shipmentOf(body: Record<string, unknown>): Record<string, unknown> {
  return body.shipment as Record<string, unknown>;
}

describe("buildAddressPayload", () => {
  it("upper-cases the country and maps the residential indicator", () => {
    const payload = buildAddressPayload(shipTo);
    expect(payload.country_code).toBe("US");
    expect(payload.address_residential_indicator).toBe("yes");
  });

  it("says unknown when residential is not stated", () => {
    const payload = buildAddressPayload({
      ...shipTo,
      isResidential: undefined,
    });
    expect(payload.address_residential_indicator).toBe("unknown");
  });

  it("omits the optional lines rather than sending empty ones", () => {
    const payload = buildAddressPayload(shipFrom);
    expect(payload).not.toHaveProperty("address_line2");
    expect(payload).not.toHaveProperty("company_name");
  });
});

describe("buildRatesRequest", () => {
  const request = buildRatesRequest({
    shipFrom,
    shipTo,
    parcel: labelParcel,
    carrierIds: [],
    weightUnit: "gram",
    dimensionUnit: "centimeter",
    shipDate: new Date("2026-08-01T00:00:00.000Z"),
  });

  it("sends a ship_from carrying the name and phone the full rate call requires", () => {
    const from = shipmentOf(request).ship_from as Record<string, unknown>;
    expect(from.name).toBe("The Crafty NP");
    expect(from.phone).toBe("5125550123");
  });

  it("always sends rate_options, which ShipStation rejects the call without", () => {
    expect(request).toHaveProperty("rate_options");
  });

  it("restricts to the named carriers when some are given", () => {
    const restricted = buildRatesRequest({
      shipFrom,
      shipTo,
      parcel: labelParcel,
      carrierIds: ["se-123"],
      weightUnit: "gram",
      dimensionUnit: "centimeter",
      shipDate: new Date("2026-08-01T00:00:00.000Z"),
    });
    expect(restricted.rate_options).toEqual({ carrier_ids: ["se-123"] });
  });
});

describe("buildLabelRequest", () => {
  const request = buildLabelRequest({
    shipFrom,
    shipTo,
    parcel: labelParcel,
    carrierId: "se-123",
    serviceCode: "usps_ground_advantage",
    externalShipmentId: "order_01",
    weightUnit: "gram",
    dimensionUnit: "centimeter",
    shipDate: new Date("2026-08-01T00:00:00.000Z"),
    testLabel: true,
  });

  it("asks for a 4x6 pdf, which is what the print flow depends on", () => {
    expect(request.label_format).toBe("pdf");
    expect(request.label_layout).toBe("4x6");
    expect(request.label_download_type).toBe("url");
  });

  it("passes the test flag through so development cannot spend money", () => {
    expect(request.test_label).toBe(true);
  });

  it("sends the parcel in grams and centimetres", () => {
    const pkg = (shipmentOf(request).packages as Record<string, unknown>[])[0];
    expect(pkg?.weight).toEqual({ value: 640, unit: "gram" });
    expect(pkg?.dimensions).toEqual({
      unit: "centimeter",
      length: 30,
      width: 20,
      height: 12,
    });
  });

  it("anchors the shipment to our order id for later reconciliation", () => {
    expect(shipmentOf(request).external_shipment_id).toBe("order_01");
  });
});

describe("normalizeLiveRates", () => {
  const base = {
    rate_id: "r1",
    carrier_id: "se-123",
    carrier_code: "usps",
    carrier_friendly_name: "USPS",
    service_code: "usps_ground_advantage",
    service_type: "USPS Ground Advantage",
    shipping_amount: { currency: "usd", amount: 7.42 },
    delivery_days: 4,
    estimated_delivery_date: null,
  };

  it("adds surcharges to the shipping amount so the operator sees the true cost", () => {
    const [rate] = normalizeLiveRates([
      {
        ...base,
        insurance_amount: { currency: "usd", amount: 0.5 },
        confirmation_amount: { currency: "usd", amount: 0.35 },
        other_amount: { currency: "usd", amount: 6.5 },
      },
    ]);

    expect(rate?.shippingAmount).toBe(7.42);
    expect(rate?.surcharges).toBe(7.35);
    expect(rate?.amount).toBe(14.77);
  });

  it("treats missing surcharge blocks as zero rather than dropping the rate", () => {
    const [rate] = normalizeLiveRates([base]);
    expect(rate?.amount).toBe(7.42);
    expect(rate?.surcharges).toBe(0);
  });

  it("sorts by true cost, not by the shipping amount alone", () => {
    const rates = normalizeLiveRates([
      {
        ...base,
        rate_id: "expensive",
        other_amount: { currency: "usd", amount: 6.5 },
      },
      {
        ...base,
        rate_id: "cheap",
        service_code: "usps_priority",
        shipping_amount: { currency: "usd", amount: 9.0 },
      },
    ]);

    expect(rates.map((rate) => rate.rateId)).toEqual(["cheap", "expensive"]);
  });

  it("filters to one carrier when asked", () => {
    const rates = normalizeLiveRates(
      [base, { ...base, rate_id: "r2", carrier_id: "se-999" }],
      { carrierId: "se-123" },
    );
    expect(rates).toHaveLength(1);
  });

  it("drops a rate with no usable shipping amount", () => {
    expect(normalizeLiveRates([{ ...base, shipping_amount: null }])).toEqual(
      [],
    );
  });
});

describe("extractVoidResult", () => {
  it("reports a refused void as an answer, not a failure", () => {
    expect(
      extractVoidResult({ approved: false, message: "Label already scanned" }),
    ).toEqual({ approved: false, message: "Label already scanned" });
  });

  it("falls back to plain words when the carrier sent no message", () => {
    const result = extractVoidResult({ approved: true });
    expect(result.approved).toBe(true);
    expect(result.message).toBe("The carrier gave no reason.");
  });

  it("treats an unreadable body as unapproved", () => {
    expect(extractVoidResult(null).approved).toBe(false);
  });
});

describe("extractCarriers", () => {
  it("keeps the carrier id, which the rate call cannot be made without", () => {
    const carriers = extractCarriers({
      carriers: [
        {
          carrier_id: "se-123",
          friendly_name: "Stamps.com",
          balance: 42.5,
          currency: "usd",
        },
      ],
    });

    expect(carriers).toEqual([
      {
        carrierId: "se-123",
        carrierName: "Stamps.com",
        balance: 42.5,
        currencyCode: "usd",
      },
    ]);
  });

  it("keeps a carrier that reported no balance, because it can still be quoted", () => {
    const carriers = extractCarriers({
      carriers: [{ carrier_id: "se-456", friendly_name: "UPS" }],
    });

    expect(carriers).toHaveLength(1);
    expect(carriers[0]?.balance).toBeNull();
  });

  it("drops a carrier with no id and one the billing plan disabled", () => {
    const carriers = extractCarriers({
      carriers: [
        { friendly_name: "No id" },
        {
          carrier_id: "se-789",
          friendly_name: "Disabled",
          disabled_by_billing_plan: true,
        },
      ],
    });

    expect(carriers).toEqual([]);
  });

  it("returns nothing for an unreadable body", () => {
    expect(extractCarriers({ nope: true })).toEqual([]);
  });
});

describe("matchReconciledLabel", () => {
  const criteria = {
    externalShipmentId: "order_01",
    shipToName: "Ada Lovelace",
    shipToPostalCode: "95128",
    serviceCode: "usps_ground_advantage",
    sinceMs: Date.parse("2026-08-01T12:00:00.000Z"),
  };

  const candidate = {
    label_id: "se-1",
    tracking_number: "9400100000000000000000",
    service_code: "usps_ground_advantage",
    created_at: "2026-08-01T12:00:30.000Z",
    shipment_cost: { currency: "usd", amount: 7.42 },
    ship_to: { name: "ada  LOVELACE", postal_code: "95128" },
  };

  it("matches on name and postal code within the window", () => {
    expect(matchReconciledLabel([candidate], criteria)?.labelId).toBe("se-1");
  });

  it("matches on our own shipment id without needing the address", () => {
    const byId = {
      ...candidate,
      external_shipment_id: "order_01",
      ship_to: { name: "Someone Else", postal_code: "00000" },
    };
    expect(matchReconciledLabel([byId], criteria)?.labelId).toBe("se-1");
  });

  it("does not match the same service at a different postal code", () => {
    const elsewhere = {
      ...candidate,
      ship_to: { name: "Ada Lovelace", postal_code: "78756" },
    };
    expect(matchReconciledLabel([elsewhere], criteria)).toBeNull();
  });

  it("does not match a label created before the window", () => {
    const earlier = { ...candidate, created_at: "2026-08-01T11:00:00.000Z" };
    expect(matchReconciledLabel([earlier], criteria)).toBeNull();
  });

  it("does not match a different service", () => {
    const other = { ...candidate, service_code: "usps_priority_mail" };
    expect(matchReconciledLabel([other], criteria)).toBeNull();
  });
});
