import type { Logger } from "@medusajs/framework/types";
import Stripe from "stripe";

import {
  buildCalculationParams,
  buildProviderCalculationInput,
  normalizeProviderCalculation,
  STRIPE_TAX_UNAVAILABLE_LOG_TAG,
  toStripeTaxError,
  validateStripeTaxOptions,
  type StripeTaxOptions,
} from "./lib";

type InjectedDependencies = {
  logger: Logger;
};

type ItemTaxCalculationLine = {
  line_item: {
    id: string;
    unit_price?: number;
    quantity?: number;
    currency_code?: string;
  };
};

type ShippingTaxCalculationLine = {
  shipping_line: {
    id: string;
    unit_price?: number;
    currency_code?: string;
  };
};

type TaxCalculationContext = {
  address: {
    country_code: string;
    province_code?: string | null;
    city?: string;
    postal_code?: string;
  };
};

type ItemTaxLineDTO = {
  rate: number;
  code: string | null;
  name: string;
  provider_id: string;
  line_item_id: string;
};

type ShippingTaxLineDTO = {
  rate: number;
  code: string | null;
  name: string;
  provider_id: string;
  shipping_line_id: string;
};

/**
 * Calculates tax lines via Stripe Tax at cart-refresh time. Every getTaxLines
 * call is a live Stripe calculation — there is deliberately no cache here
 * (unlike the sibling StripeTaxModuleService, which the tax-quote route still
 * uses for its own signed-token flow); a cart refresh is infrequent enough,
 * and a stale cached rate is worse than an extra round trip.
 */
class StripeTaxTaxProvider {
  static identifier = "stripe-tax";

  protected logger_: Logger;
  protected options_: StripeTaxOptions;
  protected client_: Stripe;

  constructor({ logger }: InjectedDependencies, options: StripeTaxOptions) {
    validateStripeTaxOptions(options as unknown as Record<string, unknown>);
    this.logger_ = logger;
    this.options_ = options;
    this.client_ = new Stripe(options.secretKey, {
      timeout: options.timeoutMs,
      maxNetworkRetries: options.maxRetries,
    });
  }

  getIdentifier() {
    return StripeTaxTaxProvider.identifier;
  }

  async getTaxLines(
    itemLines: ItemTaxCalculationLine[],
    shippingLines: ShippingTaxCalculationLine[],
    context: TaxCalculationContext,
  ): Promise<(ItemTaxLineDTO | ShippingTaxLineDTO)[]> {
    const input = buildProviderCalculationInput(
      itemLines.map((line) => ({
        id: line.line_item.id,
        unitPrice: line.line_item.unit_price ?? 0,
        quantity: line.line_item.quantity ?? 1,
        currencyCode: line.line_item.currency_code,
      })),
      shippingLines.map((line) => ({
        unitPrice: line.shipping_line.unit_price ?? 0,
        currencyCode: line.shipping_line.currency_code,
      })),
      {
        countryCode: context.address.country_code,
        postalCode: context.address.postal_code,
        city: context.address.city,
        provinceCode: context.address.province_code,
      },
    );

    const params: Stripe.Tax.CalculationCreateParams = {
      ...buildCalculationParams(input, this.options_),
      expand: ["line_items"],
    };

    let calculation: Stripe.Tax.Calculation;
    try {
      calculation = await this.client_.tax.calculations.create(params);
    } catch (error) {
      const taxError = toStripeTaxError(error);
      this.logger_.error(
        `${STRIPE_TAX_UNAVAILABLE_LOG_TAG} reason=${taxError.reason} postal=${context.address.postal_code ?? ""}`,
      );
      throw taxError;
    }

    const normalized = normalizeProviderCalculation(calculation);

    const itemTaxLines: ItemTaxLineDTO[] = itemLines.map((line) => {
      const found = normalized.itemRates.find(
        (rate) => rate.reference === line.line_item.id,
      );
      return {
        rate: found?.rate ?? 0,
        code: null,
        name: "Sales tax",
        provider_id: this.getIdentifier(),
        line_item_id: line.line_item.id,
      };
    });

    const shippingTaxLines: ShippingTaxLineDTO[] = shippingLines.map(
      (line) => ({
        rate: normalized.shippingRate,
        code: null,
        name: "Sales tax",
        provider_id: this.getIdentifier(),
        shipping_line_id: line.shipping_line.id,
      }),
    );

    return [...itemTaxLines, ...shippingTaxLines];
  }
}

export default StripeTaxTaxProvider;
