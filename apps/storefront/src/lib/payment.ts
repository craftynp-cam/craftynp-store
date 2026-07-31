import type { Cart } from "./cart";
import type { CheckoutDraft } from "./checkout";
import { isCheckoutDraftValid } from "./checkout";

export type PaymentSessionStatus = "idle" | "loading" | "ready" | "error";

export const PAYMENT_PREPARE_DEBOUNCE_MS = 500;

/**
 * Gates on the live tax status, not `draft.taxQuoteToken !== ""` — the same
 * staleness class `isDestinationReadyForTax` guards against in tax-quote.ts.
 * The draft holds the *previous* tax quote for a moment after an address or
 * shipping-rate edit, until useTaxQuote settles a fresh one.
 */
export function isReadyForPayment(
  draft: CheckoutDraft,
  taxReady: boolean,
): boolean {
  if (!taxReady || draft.taxQuoteToken === "") return false;
  return isCheckoutDraftValid(draft);
}

export function paymentPrepareKey(draft: CheckoutDraft, cart: Cart): string {
  const items = [...cart.lines]
    .map((line) => `${line.id}:${line.quantity}`)
    .sort()
    .join(",");

  const billing = draft.billingSameAsDelivery
    ? "same"
    : [
        draft.billingAddress1,
        draft.billingCity,
        draft.billingState,
        draft.billingPostalCode,
        draft.billingCountryCode,
      ].join(":");

  // The tax quote token already covers destination + shipping rate + cart
  // lines (verified server-side), so it stands in for all of that here.
  // Only email and billing details are not covered by it.
  return [
    draft.taxQuoteToken,
    draft.email.trim().toLowerCase(),
    billing,
    items,
  ].join("|");
}
