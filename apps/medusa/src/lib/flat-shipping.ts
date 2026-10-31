import { flatShippingAmount, siteContentDefault } from "@craftynp/types";

import type { NormalizedRate } from "../modules/shipstation/lib";

export const FLAT_RATE_SERVICE_CODE = "flat_rate";
export const FLAT_RATE_SHIPPING_OPTION_NAME = "Flat rate shipping";

type SiteContentReader = {
  listSiteContentEntries: (filters: {
    key: string[];
  }) => Promise<readonly { key: string; value: string }[]>;
};

export async function loadFlatShippingAmount(
  siteContent: SiteContentReader,
): Promise<number> {
  const [entry] = await siteContent.listSiteContentEntries({
    key: ["shipping_flat_rate"],
  });
  return flatShippingAmount(
    entry?.value ?? siteContentDefault("shipping_flat_rate"),
  );
}

export function flatShippingRate(amount: number): NormalizedRate {
  return {
    rateId: FLAT_RATE_SERVICE_CODE,
    carrierName: "Flat rate",
    serviceName: "Flat rate shipping",
    serviceCode: FLAT_RATE_SERVICE_CODE,
    amount,
    currencyCode: "usd",
    deliveryDays: null,
    estimatedDeliveryDate: null,
  };
}
