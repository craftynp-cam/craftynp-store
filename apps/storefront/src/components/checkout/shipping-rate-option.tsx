import type { ShippingRate } from "@craftynp/types";

import { formatDeliveryWindow } from "@/lib/shipping-rates";
import { formatMoney } from "@/lib/money";

import type { RadioCardOption } from "../ui";

export function displayLabel(rate: ShippingRate): string {
  return rate.serviceName.toLowerCase().includes(rate.carrierName.toLowerCase())
    ? rate.serviceName
    : `${rate.carrierName} ${rate.serviceName}`;
}

export function shippingRateToOption(rate: ShippingRate): RadioCardOption {
  return {
    value: rate.rateId,
    label: displayLabel(rate),
    description: formatDeliveryWindow(rate),
    trailing: formatMoney(rate.amount, rate.currencyCode),
  };
}
