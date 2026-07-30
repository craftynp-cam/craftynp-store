import type { Cart } from "./cart";
import type { CheckoutDraft } from "./checkout";
import { validateCheckoutDraft } from "./checkout";

export type TaxQuoteStatus = "idle" | "loading" | "ready" | "error";

export const TAX_QUOTE_DEBOUNCE_MS = 500;

const TAX_FIELDS = ["city", "state", "postalCode", "countryCode"] as const;

export function isDestinationReadyForTax(draft: CheckoutDraft): boolean {
  if (draft.shippingRateId === "") return false;

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
