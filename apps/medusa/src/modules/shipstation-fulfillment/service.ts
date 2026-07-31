import { AbstractFulfillmentProviderService } from "@medusajs/framework/utils";
import type { Logger } from "@medusajs/framework/types";
import type {
  CalculateShippingOptionPriceContext,
  CalculatedShippingOptionPrice,
  CreateShippingOptionDTO,
  FulfillmentOption,
} from "@medusajs/framework/types";

import { SHIPSTATION_MODULE } from "../shipstation";
import { packItemsIntoOneBox } from "../shipstation/lib";
import type ShipStationModuleService from "../shipstation/service";
import { cartSignature, verifyShippingQuote } from "../../lib/shipping-quote";
import {
  SHIPPING_QUOTE_MISMATCH_LOG_TAG,
  findRateByServiceCode,
  parseShippingMethodData,
  withinShippingTolerance,
} from "./lib";

type InjectedDependencies = {
  logger: Logger;
  [SHIPSTATION_MODULE]: ShipStationModuleService;
};

type CartVariant = {
  id: string;
  weight: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
};

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
  protected shipstation_: ShipStationModuleService;

  constructor({ logger, [SHIPSTATION_MODULE]: shipstation }: InjectedDependencies) {
    super();
    this.logger_ = logger;
    this.shipstation_ = shipstation;
  }

  override async getFulfillmentOptions(): Promise<FulfillmentOption[]> {
    return [{ id: "shipstation-live-rate" }];
  }

  override async canCalculate(_data: CreateShippingOptionDTO): Promise<boolean> {
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
      `${SHIPPING_QUOTE_MISMATCH_LOG_TAG} reason=${verified.reason} service=${shippingData.serviceCode} re-estimating`,
    );

    const packableItems = (context.items ?? []).map((item) => ({
      variantId: item.variant?.id ?? "",
      quantity: Number(item.quantity),
      weight: item.variant?.weight,
      length: item.variant?.length,
      width: item.variant?.width,
      height: item.variant?.height,
    }));

    const packed = packItemsIntoOneBox(packableItems);
    if (!packed.ok) {
      throw new Error(
        `Unable to re-estimate shipping: missing dimensions for ${packed.missing.join(",")}.`,
      );
    }

    const rates = await this.shipstation_.getUspsRates({
      destination: {
        countryCode: address.country_code,
        postalCode: address.postal_code,
        city: address.city ?? "",
        state: address.province ?? "",
      },
      parcel: packed.parcel,
    });

    const freshRate = findRateByServiceCode(rates, shippingData.serviceCode);
    if (!freshRate) {
      this.logger_.error(
        `${SHIPPING_QUOTE_MISMATCH_LOG_TAG} reason=no_matching_service service=${shippingData.serviceCode}`,
      );
      throw new Error(
        `No current shipping rate is available for ${shippingData.serviceCode}.`,
      );
    }

    const withinTolerance = withinShippingTolerance(
      shippingData.amount,
      freshRate.amount,
    );
    if (!withinTolerance) {
      this.logger_.error(
        `${SHIPPING_QUOTE_MISMATCH_LOG_TAG} reason=tolerance_exceeded service=${shippingData.serviceCode} fresh=${freshRate.amount}`,
      );
      throw new Error(
        "The quoted shipping price is no longer available and the fresh price is out of tolerance.",
      );
    }

    return {
      calculated_amount: freshRate.amount,
      is_calculated_price_tax_inclusive: false,
    };
  }
}

export default ShipStationFulfillmentProviderService;
