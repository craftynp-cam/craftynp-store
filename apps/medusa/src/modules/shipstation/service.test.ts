import { __resetForTests } from "./limiter.js";
import ShipStationModuleService from "./service.js";
import { ShipStationRateError } from "./lib.js";

const validOptions = {
  apiKey: "key",
  baseUrl: "https://api.shipstation.example/v2",
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
