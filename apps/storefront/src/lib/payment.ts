import type { Cart } from "./cart";
import type { CheckoutDraft } from "./checkout";
import { isCheckoutDraftValid } from "./checkout";

export type PaymentSessionStatus = "idle" | "loading" | "ready" | "error";

export const PAYMENT_PREPARE_DEBOUNCE_MS = 500;

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
