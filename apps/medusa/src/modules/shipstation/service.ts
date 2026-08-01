import type { ICacheService, Logger } from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";

import * as limiter from "./limiter";
import {
  SHIPSTATION_RATE_LIMIT_LOG_TAG,
  ShipStationRateError,
  buildEstimateRequest,
  extractRates,
  normalizeUspsRates,
  parseRetryAfterMs,
  rateCacheKey,
  validateShipStationOptions,
  type NormalizedRate,
  type Parcel,
  type ShipStationOptions,
} from "./lib";

type InjectedDependencies = {
  logger: Logger;
  [Modules.CACHE]: ICacheService;
};

export type ShippingDestination = {
  countryCode: string;
  postalCode: string;
  city: string;
  state: string;
  isResidential?: boolean;
};

export type GetUspsRatesInput = {
  destination: ShippingDestination;
  parcel: Parcel;
};

const MAX_RETRY_AFTER_MS = 60_000;

class ShipStationModuleService {
  protected logger_: Logger;
  protected cache_: ICacheService;
  protected options_: ShipStationOptions;

  constructor(
    { logger, [Modules.CACHE]: cache }: InjectedDependencies,
    options: ShipStationOptions,
  ) {
    validateShipStationOptions(options as unknown as Record<string, unknown>);
    this.logger_ = logger;
    this.cache_ = cache;
    this.options_ = options;
    limiter.configure(options.rateLimitPerMinute);
  }

  async getUspsRates(input: GetUspsRatesInput): Promise<NormalizedRate[]> {
    const options = this.options_;
    const key = rateCacheKey({
      countryCode: input.destination.countryCode,
      postalCode: input.destination.postalCode,
      isResidential: input.destination.isResidential,
      weightUnit: options.weightUnit,
      dimensionUnit: options.dimensionUnit,
      parcel: input.parcel,
    });

    const cached = await this.cache_.get<NormalizedRate[]>(key);
    if (cached) return cached;

    const rates = await this.fetchRatesWithRetry(input);

    if (rates.length === 0) {
      throw new ShipStationRateError("empty");
    }

    await this.cache_.set(key, rates, options.cacheTtlSeconds);
    return rates;
  }

  async registerTrackingWebhook(
    url: string,
  ): Promise<{ created: boolean; status: number }> {
    const options = this.options_;

    await limiter.acquire();

    const response = await fetch(`${options.baseUrl}/environment/webhooks`, {
      method: "POST",
      headers: {
        "API-Key": options.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url, event: "track" }),
      signal: AbortSignal.timeout(options.timeoutMs),
    });

    if (response.status === 409) {
      return { created: false, status: 409 };
    }

    if (!response.ok) {
      throw new ShipStationRateError(
        "http_error",
        `ShipStation responded ${response.status} registering the track webhook`,
      );
    }

    return { created: true, status: response.status };
  }

  private async fetchRatesWithRetry(
    input: GetUspsRatesInput,
  ): Promise<NormalizedRate[]> {
    const options = this.options_;
    let attempt = 0;

    for (;;) {
      await limiter.acquire();

      const body = buildEstimateRequest({
        from: {
          countryCode: options.fromCountryCode,
          postalCode: options.fromPostalCode,
        },
        to: input.destination,
        parcel: input.parcel,
        carrierId: options.uspsCarrierId,
        weightUnit: options.weightUnit,
        dimensionUnit: options.dimensionUnit,
        shipDate: new Date(),
      });

      let response: Response;
      try {
        response = await fetch(`${options.baseUrl}/rates/estimate`, {
          method: "POST",
          headers: {
            "API-Key": options.apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(options.timeoutMs),
        });
      } catch (error) {
        if (error instanceof Error && error.name === "TimeoutError") {
          throw new ShipStationRateError("timeout");
        }
        throw new ShipStationRateError(
          "http_error",
          error instanceof Error ? error.message : String(error),
        );
      }

      if (response.status === 429) {
        attempt += 1;
        const retryAfterMs =
          parseRetryAfterMs(
            response.headers.get("retry-after"),
            Date.now(),
            MAX_RETRY_AFTER_MS,
          ) ?? 5000;

        this.logger_.warn(
          `${SHIPSTATION_RATE_LIMIT_LOG_TAG} retry_after_ms=${retryAfterMs} attempt=${attempt}`,
        );
        limiter.blockFor(retryAfterMs);

        if (attempt > options.maxRetries) {
          throw new ShipStationRateError("rate_limit_exhausted");
        }
        continue;
      }

      if (!response.ok) {
        throw new ShipStationRateError(
          "http_error",
          `ShipStation responded ${response.status}`,
        );
      }

      const parsedBody: unknown = await response.json();
      return normalizeUspsRates(extractRates(parsedBody));
    }
  }
}

export default ShipStationModuleService;
