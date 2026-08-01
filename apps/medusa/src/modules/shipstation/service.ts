import type { ICacheService, Logger } from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";

import type { CarrierBalance, LiveRate } from "@craftynp/types";

import * as limiter from "./limiter";
import {
  SHIPSTATION_BALANCE_LOG_TAG,
  SHIPSTATION_LABEL_LOG_TAG,
  SHIPSTATION_RATE_LIMIT_LOG_TAG,
  ShipStationLabelError,
  ShipStationRateError,
  buildEstimateRequest,
  buildLabelRequest,
  buildRatesRequest,
  buildShipFromAddress,
  extractCarriers,
  extractLabel,
  extractRates,
  extractVoidResult,
  matchReconciledLabel,
  normalizeLiveRates,
  normalizeUspsRates,
  parseRetryAfterMs,
  rateCacheKey,
  validateShipStationOptions,
  type NormalizedRate,
  type Parcel,
  type CarrierSummary,
  type PurchasedLabel,
  type ShipStationAddress,
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

export type GetShipmentRatesInput = {
  destination: ShipStationAddress;
  parcel: Parcel;
  carrierIds?: readonly string[];
};

export type PurchaseLabelInput = {
  destination: ShipStationAddress;
  parcel: Parcel;
  carrierId: string;
  serviceCode: string;
  externalShipmentId: string;
};

export type ReconcileLabelInput = {
  externalShipmentId: string;
  shipToName: string;
  shipToPostalCode: string;
  serviceCode: string;
  sinceMs: number;
};

type TransportFailure = {
  kind: "timeout" | "network" | "rate_limit_exhausted" | "http";
  status?: number;
  body?: unknown;
  message?: string;
};

const MAX_RETRY_AFTER_MS = 60_000;
const BALANCE_CACHE_TTL_SECONDS = 60;

function readCarrierErrors(body: unknown): {
  message: string | null;
  code: string | null;
} {
  if (body == null || typeof body !== "object") {
    return { message: null, code: null };
  }

  const errors = (body as Record<string, unknown>).errors;
  if (!Array.isArray(errors) || errors.length === 0) {
    return { message: null, code: null };
  }

  const messages: string[] = [];
  let code: string | null = null;

  for (const raw of errors) {
    if (raw == null || typeof raw !== "object") continue;
    const entry = raw as Record<string, unknown>;
    if (typeof entry.message === "string") messages.push(entry.message);
    if (code == null && typeof entry.error_code === "string") {
      code = entry.error_code;
    }
  }

  return { message: messages.length > 0 ? messages.join(" ") : null, code };
}

function toRateError(failure: TransportFailure): Error {
  switch (failure.kind) {
    case "timeout":
      return new ShipStationRateError("timeout");
    case "rate_limit_exhausted":
      return new ShipStationRateError("rate_limit_exhausted");
    case "http":
      return new ShipStationRateError(
        "http_error",
        `ShipStation responded ${failure.status}`,
      );
    default:
      return new ShipStationRateError("http_error", failure.message);
  }
}

function toLabelError(failure: TransportFailure): Error {
  return labelErrorFor(failure, "timeout");
}

function toPurchaseError(failure: TransportFailure): Error {
  return labelErrorFor(failure, "timeout_unconfirmed");
}

function labelErrorFor(
  failure: TransportFailure,
  timeoutReason: "timeout" | "timeout_unconfirmed",
): Error {
  switch (failure.kind) {
    case "timeout":
      return new ShipStationLabelError(timeoutReason);
    case "network":
      return new ShipStationLabelError("http_error", failure.message);
    case "rate_limit_exhausted":
      return new ShipStationLabelError("rate_limit_exhausted");
    default: {
      const { message, code } = readCarrierErrors(failure.body);

      if (code === "insufficient_funds") {
        return new ShipStationLabelError(
          "insufficient_funds",
          `ShipStation responded ${failure.status}`,
          message,
        );
      }

      if (
        failure.status != null &&
        failure.status >= 400 &&
        failure.status < 500
      ) {
        return new ShipStationLabelError(
          "rejected",
          `ShipStation responded ${failure.status}`,
          message,
        );
      }

      return new ShipStationLabelError(
        "http_error",
        `ShipStation responded ${failure.status}`,
        message,
      );
    }
  }
}

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

  async getShipmentRates(input: GetShipmentRatesInput): Promise<LiveRate[]> {
    const options = this.options_;

    const carrierIds =
      input.carrierIds && input.carrierIds.length > 0
        ? [...input.carrierIds]
        : (await this.listCarriers()).map((carrier) => carrier.carrierId);

    if (carrierIds.length === 0) {
      throw new ShipStationLabelError(
        "misconfigured",
        "No carriers are connected to this ShipStation account, so nothing can be quoted",
      );
    }

    const body = buildRatesRequest({
      shipFrom: buildShipFromAddress(options),
      shipTo: input.destination,
      parcel: input.parcel,
      carrierIds,
      weightUnit: options.weightUnit,
      dimensionUnit: options.dimensionUnit,
      shipDate: new Date(),
    });

    const parsed = await this.requestJson({
      url: `${options.baseUrl}/rates`,
      method: "POST",
      body,
      timeoutMs: options.labelTimeoutMs,
      retryOn429: true,
      mapError: toLabelError,
    });

    return normalizeLiveRates(extractRates(parsed));
  }

  async purchaseLabel(input: PurchaseLabelInput): Promise<PurchasedLabel> {
    const options = this.options_;

    const body = buildLabelRequest({
      shipFrom: buildShipFromAddress(options),
      shipTo: input.destination,
      parcel: input.parcel,
      carrierId: input.carrierId,
      serviceCode: input.serviceCode,
      externalShipmentId: input.externalShipmentId,
      weightUnit: options.weightUnit,
      dimensionUnit: options.dimensionUnit,
      shipDate: new Date(),
      testLabel: options.testLabels,
    });

    const parsed = await this.requestJson({
      url: `${options.baseUrl}/labels`,
      method: "POST",
      body,
      timeoutMs: options.labelTimeoutMs,
      retryOn429: true,
      mapError: toPurchaseError,
    });

    const label = extractLabel(parsed);
    if (!label) {
      throw new ShipStationLabelError(
        "http_error",
        "ShipStation returned a label response we could not read",
      );
    }

    return label;
  }

  async reconcileLabel(
    input: ReconcileLabelInput,
  ): Promise<PurchasedLabel | null> {
    const options = this.options_;
    const since = new Date(input.sinceMs);

    try {
      const parsed = await this.requestJson({
        url: `${options.baseUrl}/labels?label_status=completed&created_at_start=${encodeURIComponent(since.toISOString())}&page_size=100`,
        method: "GET",
        timeoutMs: options.labelTimeoutMs,
        retryOn429: false,
        mapError: toLabelError,
      });

      const labels =
        parsed != null && typeof parsed === "object"
          ? (parsed as Record<string, unknown>).labels
          : null;

      if (!Array.isArray(labels)) return null;

      return matchReconciledLabel(labels, {
        externalShipmentId: input.externalShipmentId,
        shipToName: input.shipToName,
        shipToPostalCode: input.shipToPostalCode,
        serviceCode: input.serviceCode,
        sinceMs: input.sinceMs,
      });
    } catch (error) {
      this.logger_.warn(
        `${SHIPSTATION_LABEL_LOG_TAG} reason=reconcile_failed order=${input.externalShipmentId} error=${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  async voidLabel(
    labelId: string,
  ): Promise<{ approved: boolean; message: string }> {
    const options = this.options_;

    const parsed = await this.requestJson({
      url: `${options.baseUrl}/labels/${encodeURIComponent(labelId)}/void`,
      method: "PUT",
      timeoutMs: options.labelTimeoutMs,
      retryOn429: true,
      mapError: toLabelError,
    });

    return extractVoidResult(parsed);
  }

  async getCarrierBalances(): Promise<CarrierBalance[]> {
    try {
      const carriers = await this.listCarriers();

      return carriers.flatMap((carrier) =>
        carrier.balance == null
          ? []
          : [
              {
                carrierName: carrier.carrierName,
                balance: carrier.balance,
                currencyCode: carrier.currencyCode,
              },
            ],
      );
    } catch (error) {
      this.logger_.warn(
        `${SHIPSTATION_BALANCE_LOG_TAG} reason=unavailable error=${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  private async listCarriers(): Promise<CarrierSummary[]> {
    const options = this.options_;
    const key = "shipstation:carriers:v1";

    const cached = await this.cache_.get<CarrierSummary[]>(key);
    if (cached) return cached;

    const parsed = await this.requestJson({
      url: `${options.baseUrl}/carriers`,
      method: "GET",
      timeoutMs: options.timeoutMs,
      retryOn429: false,
      mapError: toLabelError,
    });

    const carriers = extractCarriers(parsed);
    await this.cache_.set(key, carriers, BALANCE_CACHE_TTL_SECONDS);
    return carriers;
  }

  async downloadLabelPdf(pdfUrl: string): Promise<Buffer> {
    const options = this.options_;

    await limiter.acquire();

    let response: Response;
    try {
      response = await fetch(pdfUrl, {
        headers: { "API-Key": options.apiKey },
        signal: AbortSignal.timeout(options.labelTimeoutMs),
      });
    } catch (error) {
      throw new ShipStationLabelError(
        error instanceof Error && error.name === "TimeoutError"
          ? "timeout"
          : "http_error",
        error instanceof Error ? error.message : String(error),
      );
    }

    if (!response.ok) {
      throw new ShipStationLabelError(
        "http_error",
        `ShipStation responded ${response.status} downloading the label`,
      );
    }

    return Buffer.from(await response.arrayBuffer());
  }

  private async fetchRatesWithRetry(
    input: GetUspsRatesInput,
  ): Promise<NormalizedRate[]> {
    const options = this.options_;

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

    const parsed = await this.requestJson({
      url: `${options.baseUrl}/rates/estimate`,
      method: "POST",
      body,
      timeoutMs: options.timeoutMs,
      retryOn429: true,
      mapError: toRateError,
    });

    return normalizeUspsRates(extractRates(parsed));
  }

  private async requestJson(input: {
    url: string;
    method: string;
    body?: unknown;
    timeoutMs: number;
    retryOn429: boolean;
    mapError: (failure: TransportFailure) => Error;
  }): Promise<unknown> {
    const options = this.options_;
    let attempt = 0;

    for (;;) {
      await limiter.acquire();

      let response: Response;
      try {
        response = await fetch(input.url, {
          method: input.method,
          headers: {
            "API-Key": options.apiKey,
            "Content-Type": "application/json",
          },
          ...(input.body === undefined
            ? {}
            : { body: JSON.stringify(input.body) }),
          signal: AbortSignal.timeout(input.timeoutMs),
        });
      } catch (error) {
        const timedOut =
          error instanceof Error && error.name === "TimeoutError";
        throw input.mapError({
          kind: timedOut ? "timeout" : "network",
          message: error instanceof Error ? error.message : String(error),
        });
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

        if (!input.retryOn429 || attempt > options.maxRetries) {
          throw input.mapError({ kind: "rate_limit_exhausted" });
        }
        continue;
      }

      if (!response.ok) {
        const errorBody: unknown = await response.json().catch(() => null);
        throw input.mapError({
          kind: "http",
          status: response.status,
          body: errorBody,
        });
      }

      return (await response.json()) as unknown;
    }
  }
}

export default ShipStationModuleService;
