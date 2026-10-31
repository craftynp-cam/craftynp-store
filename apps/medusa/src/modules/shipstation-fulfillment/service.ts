import { AbstractFulfillmentProviderService } from "@medusajs/framework/utils";
import type { Logger } from "@medusajs/framework/types";
import type {
  CalculateShippingOptionPriceContext,
  CalculatedShippingOptionPrice,
  CreateFulfillmentResult,
  CreateShippingOptionDTO,
  FulfillmentOption,
} from "@medusajs/framework/types";

import { SITE_CONTENT_MODULE } from "../site-content";
import type SiteContentModuleService from "../site-content/service";
import {
  FLAT_RATE_SERVICE_CODE,
  loadFlatShippingAmount,
} from "../../lib/flat-shipping";
import { cartSignature, verifyShippingQuote } from "../../lib/shipping-quote";
import {
  SHIPPING_QUOTE_MISMATCH_LOG_TAG,
  parseShippingMethodData,
  withinShippingTolerance,
} from "./lib";

type InjectedDependencies = {
  logger: Logger;
  [SITE_CONTENT_MODULE]: SiteContentModuleService;
};

type CartVariant = { id: string };

type CartItem = {
  quantity: unknown;
  variant?: CartVariant | null;
};

type CalculatePriceContext = {
  items?: readonly CartItem[];
  shipping_address?: {
    country_code: string | null;
    postal_code: string | null;
    city: string | null;
    province: string | null;
  } | null;
};

class ShipStationFulfillmentProviderService extends AbstractFulfillmentProviderService {
  static override identifier = "shipstation";

  protected logger_: Logger;
  protected siteContent_: SiteContentModuleService;

  constructor({
    logger,
    [SITE_CONTENT_MODULE]: siteContent,
  }: InjectedDependencies) {
    super();
    this.logger_ = logger;
    this.siteContent_ = siteContent;
  }

  override async getFulfillmentOptions(): Promise<FulfillmentOption[]> {
    return [{ id: "shipstation-live-rate" }];
  }

  override async canCalculate(
    _data: CreateShippingOptionDTO,
  ): Promise<boolean> {
    return true;
  }

  override async validateFulfillmentData(
    _optionData: Record<string, unknown>,
    data: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const parsed = parseShippingMethodData(data);
    if (!parsed) {
      throw new Error(
        "Shipping method data must include rateId, serviceCode, amount, and quoteToken.",
      );
    }
    return data;
  }

  override async calculatePrice(
    _optionData: Record<string, unknown>,
    data: Record<string, unknown>,
    rawContext: CalculateShippingOptionPriceContext,
  ): Promise<CalculatedShippingOptionPrice> {
    const context = rawContext as unknown as CalculatePriceContext;
    const shippingData = parseShippingMethodData(data);
    if (!shippingData) {
      throw new Error(
        "Shipping method data must include rateId, serviceCode, and quoteToken.",
      );
    }

    const address = context.shipping_address;
    if (!address?.postal_code || !address.country_code) {
      throw new Error("A shipping address is required to calculate price.");
    }

    const items = (context.items ?? []).map((item) => ({
      variantId: item.variant?.id ?? "",
      quantity: Number(item.quantity),
    }));

    const signature = cartSignature({
      items,
      postalCode: address.postal_code,
      countryCode: address.country_code,
    });

    const verified = verifyShippingQuote(
      shippingData.quoteToken,
      process.env.SHIPPING_QUOTE_SECRET as string,
      { cartSignature: signature },
    );

    if (verified.valid) {
      return {
        calculated_amount: verified.payload.amt,
        is_calculated_price_tax_inclusive: false,
      };
    }

    this.logger_.warn(
      `${SHIPPING_QUOTE_MISMATCH_LOG_TAG} reason=${verified.reason} service=${shippingData.serviceCode} re-pricing`,
    );

    if (shippingData.serviceCode !== FLAT_RATE_SERVICE_CODE) {
      this.logger_.error(
        `${SHIPPING_QUOTE_MISMATCH_LOG_TAG} reason=no_matching_service service=${shippingData.serviceCode}`,
      );
      throw new Error(
        `No current shipping rate is available for ${shippingData.serviceCode}.`,
      );
    }

    const freshAmount = await loadFlatShippingAmount(this.siteContent_);
    if (!withinShippingTolerance(shippingData.amount, freshAmount)) {
      this.logger_.error(
        `${SHIPPING_QUOTE_MISMATCH_LOG_TAG} reason=tolerance_exceeded service=${shippingData.serviceCode} fresh=${freshAmount}`,
      );
      throw new Error(
        "The quoted shipping price is no longer available and the fresh price is out of tolerance.",
      );
    }

    return {
      calculated_amount: freshAmount,
      is_calculated_price_tax_inclusive: false,
    };
  }

  override async createFulfillment(
    data: Record<string, unknown>,
  ): Promise<CreateFulfillmentResult> {
    return { data, labels: [] };
  }

  override async cancelFulfillment(
    data: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return data;
  }

  override async getFulfillmentDocuments(): Promise<never[]> {
    return [];
  }
}

export default ShipStationFulfillmentProviderService;
