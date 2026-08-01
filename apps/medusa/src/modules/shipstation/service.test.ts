import { __resetForTests } from "./limiter.js";
import ShipStationModuleService from "./service.js";
import { ShipStationRateError } from "./lib.js";

const validOptions = {
  apiKey: "key",
  baseUrl: "https://api.shipstation.example/v2",
  uspsCarrierId: "se-123",
  rateLimitPerMinute: 200,
  timeoutMs: 5000,
  labelTimeoutMs: 30000,
  maxRetries: 2,
  weightUnit: "gram",
  dimensionUnit: "centimeter",
  cacheTtlSeconds: 900,
  testLabels: true,
  fromName: "The Crafty NP",
  fromPhone: "5125550123",
  fromAddress1: "1 Maker Way",
  fromCity: "Austin",
  fromState: "TX",
  fromCountryCode: "US",
  fromPostalCode: "78756",
};

const destination = {
  countryCode: "us",
  postalCode: "95128",
  city: "San Jose",
  state: "CA",
};

const parcel = { weight: 400, length: 30, width: 20, height: 10 };

function jsonResponse(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
) {
  return {
    ok: (init.status ?? 200) < 300,
    status: init.status ?? 200,
    headers: {
      get: (name: string) => init.headers?.[name.toLowerCase()] ?? null,
    },
    json: async () => body,
  } as unknown as Response;
}

function createMemoryCache() {
  const store = new Map<string, unknown>();
  return {
    get: jest.fn(async (key: string) => store.get(key) ?? null),
    set: jest.fn(async (key: string, value: unknown) => {
      store.set(key, value);
    }),
  };
}

function makeService(
  cache = createMemoryCache(),
  logger = { warn: jest.fn(), error: jest.fn() },
) {
  return {
    service: new ShipStationModuleService(
      { logger: logger as never, cache: cache as never },
      validOptions,
    ),
    cache,
    logger,
  };
}

const uspsRate = {
  carrier_code: "usps",
  carrier_friendly_name: "USPS",
  service_code: "usps_ground_advantage",
  service_type: "USPS Ground Advantage",
  rate_id: "r1",
  shipping_amount: { currency: "usd", amount: 7.42 },
  delivery_days: 4,
  estimated_delivery_date: null,
};

describe("ShipStationModuleService", () => {
  beforeEach(() => {
    __resetForTests();
    jest.restoreAllMocks();
  });

  it("returns normalized rates on the happy path", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce(jsonResponse([uspsRate]));

    const { service } = makeService();
    const rates = await service.getUspsRates({ destination, parcel });

    expect(rates).toHaveLength(1);
    expect(rates[0]?.serviceCode).toBe("usps_ground_advantage");
  });

  it("honours Retry-After on a 429 and succeeds on the next attempt", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        jsonResponse(
          { errors: [] },
          { status: 429, headers: { "retry-after": "0" } },
        ),
      )
      .mockResolvedValueOnce(jsonResponse([uspsRate]));

    const { service, logger } = makeService();
    const rates = await service.getUspsRates({ destination, parcel });

    expect(rates).toHaveLength(1);
    expect(logger.warn).toHaveBeenCalled();
  });

  it("throws rate_limit_exhausted once retries are used up", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        jsonResponse({}, { status: 429, headers: { "retry-after": "0" } }),
      );

    const { service } = makeService();
    await expect(
      service.getUspsRates({ destination, parcel }),
    ).rejects.toMatchObject({ reason: "rate_limit_exhausted" });
  });

  it("throws timeout when fetch aborts", async () => {
    const abortError = new Error("aborted");
    abortError.name = "TimeoutError";
    jest.spyOn(global, "fetch").mockRejectedValueOnce(abortError);

    const { service } = makeService();
    await expect(
      service.getUspsRates({ destination, parcel }),
    ).rejects.toMatchObject({ reason: "timeout" });
  });

  it("throws empty when no USPS rates come back", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce(jsonResponse([]));

    const { service } = makeService();
    await expect(
      service.getUspsRates({ destination, parcel }),
    ).rejects.toMatchObject({ reason: "empty" });
  });

  it("skips fetch entirely on a cache hit", async () => {
    const cache = createMemoryCache();
    const { service } = makeService(cache);
    const fetchSpy = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(jsonResponse([uspsRate]));

    await service.getUspsRates({ destination, parcel });
    await service.getUspsRates({ destination, parcel });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("never caches an empty or failed result", async () => {
    const cache = createMemoryCache();
    jest.spyOn(global, "fetch").mockResolvedValue(jsonResponse([]));

    const { service } = makeService(cache);
    await expect(
      service.getUspsRates({ destination, parcel }),
    ).rejects.toBeInstanceOf(ShipStationRateError);
    expect(cache.set).not.toHaveBeenCalled();
  });
});

const labelDestination = {
  name: "Ada Lovelace",
  phone: "4085550147",
  addressLine1: "500 Almaden Blvd",
  cityLocality: "San Jose",
  stateProvince: "CA",
  postalCode: "95128",
  countryCode: "US",
  isResidential: true,
};

const labelResponse = {
  label_id: "se-1",
  status: "completed",
  tracking_number: "9400100000000000000000",
  carrier_code: "usps",
  carrier_id: "se-123",
  service_code: "usps_ground_advantage",
  shipment_cost: { currency: "usd", amount: 8.47 },
  insurance_cost: { currency: "usd", amount: 0 },
  label_download: { pdf: "https://api.shipstation.example/labels/se-1.pdf" },
};

function timeoutError() {
  const error = new Error("aborted");
  error.name = "TimeoutError";
  return error;
}

function buyInput() {
  return {
    destination: labelDestination,
    parcel,
    carrierId: "se-123",
    serviceCode: "usps_ground_advantage",
    externalShipmentId: "order_01",
  };
}

describe("ShipStationModuleService.purchaseLabel", () => {
  beforeEach(() => {
    __resetForTests();
    jest.restoreAllMocks();
  });

  it("never retries a timeout, because a retry could buy a second label", async () => {
    const fetchSpy = jest
      .spyOn(global, "fetch")
      .mockRejectedValue(timeoutError());

    const { service } = makeService();

    await expect(service.purchaseLabel(buyInput())).rejects.toMatchObject({
      reason: "timeout_unconfirmed",
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("does retry a 429, which is refused before any label is made", async () => {
    const fetchSpy = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({}, { status: 429, headers: { "retry-after": "0" } }),
      )
      .mockResolvedValueOnce(jsonResponse(labelResponse));

    const { service } = makeService();
    const label = await service.purchaseLabel(buyInput());

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(label.trackingNumber).toBe("9400100000000000000000");
    expect(label.shipmentCost).toBe(8.47);
  });

  it("reports a low balance as its own reason so the operator knows to top up", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce(
      jsonResponse(
        {
          errors: [
            { error_code: "insufficient_funds", message: "Not enough funds" },
          ],
        },
        { status: 400 },
      ),
    );

    const { service } = makeService();
    await expect(service.purchaseLabel(buyInput())).rejects.toMatchObject({
      reason: "insufficient_funds",
      carrierMessage: "Not enough funds",
    });
  });

  it("treats any other 4xx as a rejection and keeps the carrier's words", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce(
      jsonResponse(
        {
          errors: [{ error_code: "invalid_address", message: "Bad postcode" }],
        },
        { status: 400 },
      ),
    );

    const { service } = makeService();
    await expect(service.purchaseLabel(buyInput())).rejects.toMatchObject({
      reason: "rejected",
      carrierMessage: "Bad postcode",
    });
  });

  it("refuses a response it cannot read rather than inventing a label", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(jsonResponse({ label_id: "se-1" }));

    const { service } = makeService();
    await expect(service.purchaseLabel(buyInput())).rejects.toMatchObject({
      reason: "http_error",
    });
  });
});

describe("ShipStationModuleService.getShipmentRates", () => {
  beforeEach(() => {
    __resetForTests();
    jest.restoreAllMocks();
  });

  const ratesBody = {
    rate_response: {
      rates: [
        {
          rate_id: "r1",
          carrier_id: "se-123",
          carrier_code: "usps",
          service_code: "usps_ground_advantage",
          shipping_amount: { currency: "usd", amount: 7.42 },
        },
      ],
    },
  };

  const carriersBody = {
    carriers: [
      {
        carrier_id: "se-123",
        friendly_name: "Stamps.com",
        balance: 42.5,
        currency: "usd",
      },
    ],
  };

  function mockCarriersThenRates() {
    return jest
      .spyOn(global, "fetch")
      .mockImplementation(async (input: Parameters<typeof fetch>[0]) =>
        String(input).includes("/carriers")
          ? jsonResponse(carriersBody)
          : jsonResponse(ratesBody),
      );
  }

  function rateCalls(spy: jest.SpiedFunction<typeof fetch>) {
    return spy.mock.calls.filter(([url]) => String(url).endsWith("/rates"));
  }

  it("never caches a rate, because the operator is choosing what to spend", async () => {
    const cache = createMemoryCache();
    const fetchSpy = mockCarriersThenRates();

    const { service } = makeService(cache);
    await service.getShipmentRates({ destination: labelDestination, parcel });
    await service.getShipmentRates({ destination: labelDestination, parcel });

    expect(rateCalls(fetchSpy)).toHaveLength(2);
    expect(cache.set).not.toHaveBeenCalledWith(
      expect.stringContaining("rates"),
      expect.anything(),
      expect.anything(),
    );
  });

  it("names every connected carrier, because ShipStation rejects an empty rate_options", async () => {
    const fetchSpy = mockCarriersThenRates();

    const { service } = makeService();
    await service.getShipmentRates({ destination: labelDestination, parcel });

    const body = JSON.parse(
      String(rateCalls(fetchSpy)[0]?.[1]?.body),
    ) as Record<string, unknown>;

    expect(body.rate_options).toEqual({ carrier_ids: ["se-123"] });
  });

  it("refuses rather than calling ShipStation when no carrier is connected", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(jsonResponse({ carriers: [] }));

    const { service } = makeService();
    await expect(
      service.getShipmentRates({ destination: labelDestination, parcel }),
    ).rejects.toMatchObject({ reason: "misconfigured" });
  });
});

describe("ShipStationModuleService.voidLabel", () => {
  beforeEach(() => {
    __resetForTests();
    jest.restoreAllMocks();
  });

  it("returns a refused void rather than throwing, so we can show the reason", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({ approved: false, message: "Label already scanned" }),
      );

    const { service } = makeService();

    await expect(service.voidLabel("se-1")).resolves.toEqual({
      approved: false,
      message: "Label already scanned",
    });
  });

  it("throws when the call itself fails, so we never stamp a void we did not confirm", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(jsonResponse({}, { status: 500 }));

    const { service } = makeService();
    await expect(service.voidLabel("se-1")).rejects.toMatchObject({
      reason: "http_error",
    });
  });
});

describe("ShipStationModuleService.getCarrierBalances", () => {
  beforeEach(() => {
    __resetForTests();
    jest.restoreAllMocks();
  });

  it("degrades to an empty list and logs rather than blocking the workspace", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(jsonResponse({}, { status: 500 }));

    const { service, logger } = makeService();

    await expect(service.getCarrierBalances()).resolves.toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("[shipstation:balance]"),
    );
  });

  it("caches so a busy queue page does not burn the rate limit", async () => {
    const cache = createMemoryCache();
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(
      jsonResponse({
        carriers: [{ friendly_name: "USPS", balance: 42.5, currency: "usd" }],
      }),
    );

    const { service } = makeService(cache);
    await service.getCarrierBalances();
    await service.getCarrierBalances();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
