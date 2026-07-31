import type { Logger } from "@medusajs/framework/types";
import Stripe from "stripe";

import {
  buildCalculationParams,
  buildProviderCalculationInput,
  normalizeProviderCalculation,
  STRIPE_TAX_UNAVAILABLE_LOG_TAG,
  toStripeTaxError,
  validateStripeTaxProviderOptions,
  type StripeTaxProviderOptions,
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
  code: string;
  name: string;
  provider_id: string;
  line_item_id: string;
};

type ShippingTaxLineDTO = {
  rate: number;
  code: string;
  name: string;
  provider_id: string;
  shipping_line_id: string;
};

const PLACEHOLDER_ITEM_REFERENCE = "__shipping_only_placeholder__";

class StripeTaxTaxProvider {
  static identifier = "stripe-tax";

  protected logger_: Logger;
  protected options_: StripeTaxProviderOptions;
  protected client_: Stripe;

  constructor(
    { logger }: InjectedDependencies,
    options: StripeTaxProviderOptions,
  ) {
    validateStripeTaxProviderOptions(
      options as unknown as Record<string, unknown>,
    );
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
    const requestItemLines =
      itemLines.length > 0
        ? itemLines.map((line) => ({
            id: line.line_item.id,
            unitPrice: line.line_item.unit_price ?? 0,
            quantity: line.line_item.quantity ?? 1,
            currencyCode: line.line_item.currency_code,
          }))
        : [
            {
              id: PLACEHOLDER_ITEM_REFERENCE,
              unitPrice: 0,
              quantity: 1,
              currencyCode: shippingLines[0]?.shipping_line.currency_code,
            },
          ];

    const input = buildProviderCalculationInput(
      requestItemLines,
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
        code: "sales_tax",
        name: "Sales tax",
        provider_id: this.getIdentifier(),
        line_item_id: line.line_item.id,
      };
    });

    const shippingTaxLines: ShippingTaxLineDTO[] = shippingLines.map(
      (line) => ({
        rate: normalized.shippingRate,
        code: "sales_tax",
        name: "Sales tax",
        provider_id: this.getIdentifier(),
        shipping_line_id: line.shipping_line.id,
      }),
    );

    return [...itemTaxLines, ...shippingTaxLines];
  }
}

export default StripeTaxTaxProvider;
