import type { ShippingRate } from "@craftynp/types";

import type { Cart } from "./cart";
import type { CheckoutDraft } from "./checkout";
import { validateCheckoutDraft } from "./checkout";

export type ShippingRateStatus = "idle" | "loading" | "ready" | "error";

export const SHIPPING_RATE_DEBOUNCE_MS = 500;

const ADDRESS_FIELDS = ["city", "state", "postalCode", "countryCode"] as const;

export function isDestinationReadyForRates(draft: CheckoutDraft): boolean {
  const errors = validateCheckoutDraft(draft);
  return ADDRESS_FIELDS.every((field) => errors[field] == null);
}

export function shippingRateKey(draft: CheckoutDraft, cart: Cart): string {
  const items = [...cart.lines]
    .map((line) => `${line.id}:${line.quantity}`)
    .sort()
    .join(",");

  return [draft.countryCode.toLowerCase(), draft.postalCode.trim(), items].join(
    "|",
  );
}

export function cheapestRateId(rates: readonly ShippingRate[]): string | null {
  if (rates.length === 0) return null;

  return rates.reduce((cheapest, rate) =>
    rate.amount < cheapest.amount ? rate : cheapest,
  ).rateId;
}

/**
 * The single definition of what selecting a rate writes to the draft. Both the
 * shopper's own click and `useShippingRates`' auto-preselect go through this:
 * they were separate object literals, and the auto-preselect one silently
 * omitted `shippingServiceCode`. A shopper who accepted the preselected rate
 * without clicking one therefore reached payment with a blank service code,
 * and one who picked a rate and then edited their address kept the *previous*
 * rate's code beside the new rate's quote token — a mismatch nothing validates
 * until ShipStation is asked to re-estimate a service that was never chosen.
 */
export function shippingRateDraftPatch(rate: ShippingRate) {
  return {
    shippingRateId: rate.rateId,
    shippingRateLabel: rate.serviceName,
    shippingRateAmount: rate.amount,
    shippingRateCurrency: rate.currencyCode,
    shippingServiceCode: rate.serviceCode,
    shippingQuoteToken: rate.quoteToken,
  };
}

export function selectedShippingAmount(
  rates: readonly ShippingRate[],
  rateId: string,
): number | null {
  return rates.find((rate) => rate.rateId === rateId)?.amount ?? null;
}

export function formatDeliveryWindow(rate: ShippingRate): string {
  if (rate.deliveryDays === 1) return "Arrives in 1 business day";
  if (rate.deliveryDays != null) {
    return `Arrives in ${rate.deliveryDays} business days`;
  }

  if (rate.estimatedDeliveryDate) {
    const date = new Date(rate.estimatedDeliveryDate);
    if (!Number.isNaN(date.getTime())) {
      return `Arrives ${new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }).format(date)}`;
    }
  }

  return "Delivery estimate unavailable";
}
