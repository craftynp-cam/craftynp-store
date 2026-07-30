import type { Cart } from "./cart";
import type { CheckoutDraft } from "./checkout";
import { validateCheckoutDraft } from "./checkout";

export type TaxQuoteStatus = "idle" | "loading" | "ready" | "error";

export const TAX_QUOTE_DEBOUNCE_MS = 500;

const TAX_FIELDS = ["city", "state", "postalCode", "countryCode"] as const;

/**
 * `shippingReady` must come from the live shipping-rates hook's own status
 * (`status === "ready"`), not from `draft.shippingRateId` alone — the draft
 * still holds the previous address's rate and quote token for a moment
 * after an edit, until ShipStation re-quotes and commits a fresh one. Gating
 * on the draft field alone fires a tax request signed against the old
 * postal code, which the server correctly rejects as a cart mismatch.
 */
export function isDestinationReadyForTax(
  draft: CheckoutDraft,
  shippingReady: boolean,
): boolean {
  if (!shippingReady || draft.shippingRateId === "") return false;

  const errors = validateCheckoutDraft(draft);
  return TAX_FIELDS.every((field) => errors[field] == null);
}

export function taxQuoteKey(draft: CheckoutDraft, cart: Cart): string {
  const items = [...cart.lines]
    .map((line) => `${line.id}:${line.quantity}`)
    .sort()
    .join(",");

  return [
    draft.countryCode.toLowerCase(),
    draft.postalCode.trim(),
    draft.state.trim().toLowerCase(),
    draft.city.trim().toLowerCase(),
    draft.shippingRateId,
    items,
  ].join("|");
}
