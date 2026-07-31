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
        draft.billingAddress2,
        draft.billingCity,
        draft.billingState,
        draft.billingPostalCode,
        draft.billingCountryCode,
      ].join(":");

  // The tax quote token stands in for the parts of the destination its own
  // signature covers — postal code, country, state, city, shipping rate, cart
  // lines — all verified server-side. It does *not* cover the recipient or the
  // street lines, so those are listed here explicitly: editing only address1
  // otherwise leaves the key unchanged, no re-prepare fires, and the Medusa
  // cart keeps the previous street on the order and its shipping label.
  const recipient = [
    draft.firstName,
    draft.lastName,
    draft.phone,
    draft.address1,
    draft.address2,
  ].join(":");

  return [
    draft.taxQuoteToken,
    draft.email.trim().toLowerCase(),
    recipient,
    billing,
    items,
  ].join("|");
}
