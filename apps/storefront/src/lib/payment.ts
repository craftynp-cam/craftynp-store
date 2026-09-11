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
  // Dimensions are part of a line's identity here for taxQuoteKey's reason:
  // every custom size shares one variant, so two different sizes of the same
  // variant and quantity are the same `id:quantity` and would not re-prepare —
  // leaving the shopper charged the PaymentIntent minted for the old size.
  const items = [...cart.lines]
    .map(
      (line) =>
        `${line.id}:${line.quantity}:${line.dimensions?.widthInches ?? ""}x${line.dimensions?.heightInches ?? ""}`,
    )
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
