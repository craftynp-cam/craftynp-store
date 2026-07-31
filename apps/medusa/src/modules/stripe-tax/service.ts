import type { ICacheService, Logger } from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";
import Stripe from "stripe";

import {
  buildCalculationParams,
  normalizeCalculation,
  taxCacheKey,
  toStripeTaxError,
  validateStripeTaxOptions,
  type CalculationParamsInput,
  type NormalizedCalculation,
  type StripeTaxOptions,
} from "./lib";

type InjectedDependencies = {
  logger: Logger;
  [Modules.CACHE]: ICacheService;
};

class StripeTaxModuleService {
  protected logger_: Logger;
  protected cache_: ICacheService;
  protected options_: StripeTaxOptions;
  protected client_: Stripe;

  constructor(
    { logger, [Modules.CACHE]: cache }: InjectedDependencies,
    options: StripeTaxOptions,
  ) {
    validateStripeTaxOptions(options as unknown as Record<string, unknown>);
    this.logger_ = logger;
    this.cache_ = cache;
    this.options_ = options;
    this.client_ = new Stripe(options.secretKey, {
      timeout: options.timeoutMs,
      maxNetworkRetries: options.maxRetries,
    });
  }

  async calculateTax(
    input: CalculationParamsInput,
  ): Promise<NormalizedCalculation> {
    const options = this.options_;
    const key = taxCacheKey({
      countryCode: input.destination.countryCode,
      postalCode: input.destination.postalCode,
      state: input.destination.state,
      city: input.destination.city,
      currencyCode: input.currencyCode,
      shippingAmount: input.shippingAmount,
      lineItems: input.lineItems,
    });

    const cached = await this.cache_.get<NormalizedCalculation>(key);
    if (cached) return cached;

    const params = buildCalculationParams(input, options);

    let calculation: Stripe.Tax.Calculation;
    try {
      calculation = await this.client_.tax.calculations.create(params);
    } catch (error) {
      throw toStripeTaxError(error);
    }

    const normalized = normalizeCalculation(calculation);
    await this.cache_.set(key, normalized, options.cacheTtlSeconds);
    return normalized;
  }

  async recordTransaction(
    calculationId: string,
    reference: string,
  ): Promise<void> {
    try {
      await this.client_.tax.transactions.createFromCalculation({
        calculation: calculationId,
        reference,
      });
    } catch (error) {
      throw toStripeTaxError(error);
    }
  }
}

export default StripeTaxModuleService;
