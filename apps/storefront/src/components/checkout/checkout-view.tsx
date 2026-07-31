"use client";

import { flushSync } from "react-dom";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

import {
  draftFromSavedAddress,
  NEW_ADDRESS_ID,
  type SavedAddress,
} from "@/lib/saved-address";
import type { AuthedCustomer } from "@/lib/auth";
import {
  checkoutTotals,
  type CheckoutDraft,
  type CheckoutErrors,
  type CountryOption,
  EMPTY_CHECKOUT_DRAFT,
  prefillCheckoutDraft,
  validateCheckoutDraft,
} from "@/lib/checkout";
import {
  clearCheckoutDraft,
  patchCheckoutDraft,
  readCheckoutDraft,
  readServerCheckoutDraft,
  subscribeToCheckoutDraft,
} from "@/lib/checkout-draft";
import {
  clearCart,
  readCart,
  readServerCart,
  subscribeToCart,
} from "@/lib/cart";
import { openCartDrawer } from "@/lib/cart-drawer";
import { shippingRateDraftPatch } from "@/lib/shipping-rates";
import { checkoutConfirmationHref, checkoutHref } from "@/lib/routes";
import { formatMoney } from "@/lib/money";

import { Breadcrumbs } from "../nav";
import { Button, Checkbox } from "../ui";
import { AddressFields } from "./address-fields";
import { CheckoutSection } from "./checkout-section";
import { CheckoutSummary } from "./checkout-summary";
import { ContactFields } from "./contact-fields";
import { PaymentFields, type PaymentSubmitHandle } from "./payment-fields";
import { SavedAddressPicker } from "./saved-address-picker";
import { ShippingMethodFields } from "./shipping-method-fields";
import { useShippingRates } from "./use-shipping-rates";
import { usePaymentSession } from "./use-payment-session";
import { useTaxQuote } from "./use-tax-quote";

export type CheckoutViewProps = {
  customer: AuthedCustomer | null;
  savedAddresses: readonly SavedAddress[];
  countryOptions: readonly CountryOption[];
};

function summaryMessage(errors: CheckoutErrors): string | null {
  const count = Object.keys(errors).length;
  if (count === 0) return null;
  return count === 1 ? "Check 1 field below." : `Check ${count} fields below.`;
}

export function CheckoutView({
  customer,
  savedAddresses,
  countryOptions,
}: CheckoutViewProps) {
  const router = useRouter();
  const draft = useSyncExternalStore(
    subscribeToCheckoutDraft,
    readCheckoutDraft,
    readServerCheckoutDraft,
  );
  const values = prefillCheckoutDraft(draft, customer);
  const isSignedIn = customer != null;

  const cart = useSyncExternalStore(subscribeToCart, readCart, readServerCart);
  const shippingRates = useShippingRates(values, cart);
  const taxQuote = useTaxQuote(values, cart, shippingRates.status === "ready");
  const paymentSession = usePaymentSession(
    values,
    cart,
    taxQuote.status === "ready",
  );

  const { total, currencyCode } = checkoutTotals(cart, values);

  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Paired with the clientSecret it was raised against, so a stale error
  // from a superseded Payment Element doesn't linger once PaymentFields has
  // remounted a clean one for a fresh clientSecret.
  const [payError, setPayError] = useState<{
    message: string;
    clientSecret: string | null;
  } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const paymentSubmitRef = useRef<PaymentSubmitHandle>(null);
  const submittingRef = useRef(false);
  const displayedPayError =
    payError?.clientSecret === paymentSession.clientSecret
      ? payError.message
      : null;

  function showPayError(message: string | null) {
    setPayError(
      message ? { message, clientSecret: paymentSession.clientSecret } : null,
    );
  }

  useEffect(() => {
    if (!isSignedIn || draft.savedAddressId !== "") return;
    const defaultAddress = savedAddresses[0];
    if (!defaultAddress) return;

    patchCheckoutDraft({
      savedAddressId: defaultAddress.id,
      ...draftFromSavedAddress(defaultAddress),
    });
  }, [isSignedIn, savedAddresses, draft.savedAddressId]);

  function handleChange(patch: Partial<CheckoutDraft>) {
    patchCheckoutDraft(patch);

    if (patch.billingSameAsDelivery === true) {
      setErrors((current) => {
        const {
          billingAddress1: _billingAddress1,
          billingCity: _billingCity,
          billingState: _billingState,
          billingPostalCode: _billingPostalCode,
          billingCountryCode: _billingCountryCode,
          ...rest
        } = current;
        return rest;
      });
    }
  }

  async function saveAddressIfRequested(current: CheckoutDraft) {
    if (!isSignedIn || !current.saveAddress) return;

    try {
      const response = await fetch("/checkout/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: current.firstName,
          lastName: current.lastName,
          address1: current.address1,
          address2: current.address2,
          city: current.city,
          state: current.state,
          postalCode: current.postalCode,
          countryCode: current.countryCode,
          phone: current.phone,
        }),
      });

      if (!response.ok) {
        setSaveNotice(
          "We couldn't save this address to your account, but your details are kept on this device.",
        );
      }
    } catch {
      setSaveNotice(
        "We couldn't save this address to your account, but your details are kept on this device.",
      );
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // A double-click (or a resubmitted native form event) must not fire a
    // second confirmPayment/complete pair while the first is in flight —
    // the client-side half of AC10, alongside the server's own idempotent
    // /store/checkout/complete. A ref guards this synchronously; the
    // submitting state update that follows is not visible until the next
    // render, which a second click in the same tick would race past.
    if (submittingRef.current) return;

    const nextErrors = validateCheckoutDraft(values);

    flushSync(() => {
      setErrors(nextErrors);
    });

    if (Object.keys(nextErrors).length > 0) {
      const firstInvalid = formRef.current?.querySelector<HTMLElement>(
        '[aria-invalid="true"]',
      );
      firstInvalid?.focus();
      return;
    }

    void saveAddressIfRequested(values);

    // Payment isn't ready to submit yet (still preparing, or the prepare
    // call failed) — the field-level validation above is the only feedback
    // available until it is.
    if (paymentSession.status !== "ready" || !values.cartId) {
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    showPayError(null);

    const result = await paymentSubmitRef.current?.confirmPayment();

    if (!result || result.status === "error") {
      // A decline shows Stripe's own reason, leaves the cart intact, and
      // allows retry — nothing here has cleared the cart or draft.
      showPayError(result?.message ?? "Your payment could not be processed.");
      submittingRef.current = false;
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch("/checkout/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cartId: values.cartId }),
      });

      if (!response.ok) throw new Error("order_placement_unavailable");

      const order = (await response.json()) as {
        orderId: string;
        displayId: number;
      };

      clearCart();
      clearCheckoutDraft();
      router.push(checkoutConfirmationHref(order.orderId, order.displayId));
    } catch {
      // The payment was captured — recorded on Stripe's side regardless of
      // whether this call succeeds. The webhook (AC9) reconciles the order
      // even if this request never lands, so this is a delayed confirmation,
      // not a lost payment.
      showPayError(
        "Your payment was captured, but we couldn't confirm your order just yet. We'll email your confirmation shortly.",
      );
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <>
      <Breadcrumbs labels={{ "/checkout": "Checkout" }} />
      <h1 className="mt-2 font-display text-4xl text-foreground sm:text-5xl">
        Checkout
      </h1>

      <div className="mt-8 lg:flex lg:items-start lg:gap-10">
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          noValidate
          className="min-w-0 flex-1 space-y-6"
        >
          <CheckoutSection step={1} title="Contact">
            <ContactFields
              values={values}
              errors={errors}
              onChange={handleChange}
              isSignedIn={isSignedIn}
              returnTo={checkoutHref()}
            />
          </CheckoutSection>

          <CheckoutSection step={2} title="Delivery address">
            {isSignedIn ? (
              <SavedAddressPicker
                addresses={savedAddresses}
                selectedId={values.savedAddressId}
                onSelect={(id) => {
                  const selected = savedAddresses.find(
                    (address) => address.id === id,
                  );
                  if (selected) {
                    patchCheckoutDraft({
                      savedAddressId: id,
                      ...draftFromSavedAddress(selected),
                    });
                  } else {
                    patchCheckoutDraft({
                      savedAddressId: NEW_ADDRESS_ID,
                      address1: EMPTY_CHECKOUT_DRAFT.address1,
                      address2: EMPTY_CHECKOUT_DRAFT.address2,
                      city: EMPTY_CHECKOUT_DRAFT.city,
                      state: EMPTY_CHECKOUT_DRAFT.state,
                      postalCode: EMPTY_CHECKOUT_DRAFT.postalCode,
                      countryCode: EMPTY_CHECKOUT_DRAFT.countryCode,
                    });
                  }
                }}
              />
            ) : null}

            <AddressFields
              values={values}
              errors={errors}
              onChange={handleChange}
              countryOptions={countryOptions}
            />

            {isSignedIn ? (
              <Checkbox
                isSelected={values.saveAddress}
                onChange={(isSelected) =>
                  handleChange({ saveAddress: isSelected })
                }
              >
                Save this address to my account
              </Checkbox>
            ) : null}

            {saveNotice ? (
              <p className="text-sm text-foreground-muted">{saveNotice}</p>
            ) : null}
          </CheckoutSection>

          <CheckoutSection step={3} title="Shipping method">
            <ShippingMethodFields
              status={shippingRates.status}
              rates={shippingRates.rates}
              selectedRateId={values.shippingRateId}
              error={shippingRates.error}
              errorMessage={errors.shippingRateId}
              onRetry={shippingRates.retry}
              onSelect={(rateId) => {
                const rate = shippingRates.rates.find(
                  (candidate) => candidate.rateId === rateId,
                );
                if (!rate) return;

                handleChange(shippingRateDraftPatch(rate));
              }}
            />
          </CheckoutSection>

          {taxQuote.status === "error" ? (
            <div aria-live="polite" className="space-y-3">
              <p className="text-sm text-danger-foreground">
                {taxQuote.error ??
                  "We couldn't calculate tax for your address."}
              </p>
              <button
                type="button"
                onClick={taxQuote.retry}
                className="font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Try again
              </button>
            </div>
          ) : null}

          <CheckoutSection step={4} title="Payment">
            {paymentSession.status === "ready" &&
            paymentSession.clientSecret ? (
              <PaymentFields
                clientSecret={paymentSession.clientSecret}
                submitRef={paymentSubmitRef}
                onLoadError={showPayError}
              />
            ) : paymentSession.status === "error" ? (
              <div aria-live="polite" className="space-y-3">
                <p className="text-sm text-danger-foreground">
                  {paymentSession.error ??
                    "We couldn't set up payment for this order."}
                </p>
                <button
                  type="button"
                  onClick={paymentSession.retry}
                  className="font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Try again
                </button>
              </div>
            ) : (
              <p className="text-sm text-foreground-muted" aria-live="polite">
                {paymentSession.status === "loading"
                  ? "Preparing payment…"
                  : "Complete the steps above to enter payment details."}
              </p>
            )}
          </CheckoutSection>

          {displayedPayError ? (
            <div
              aria-live="assertive"
              className="text-sm text-danger-foreground"
            >
              {displayedPayError}
            </div>
          ) : null}

          <div
            aria-live="polite"
            aria-atomic="true"
            className="text-sm text-danger-foreground"
          >
            {summaryMessage(errors)}
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full rounded-full"
            isLoading={submitting}
            loadingLabel="Placing your order"
          >
            {`Pay ${formatMoney(total, currencyCode)}`}
          </Button>
        </form>

        <CheckoutSummary onEditCart={openCartDrawer} />
      </div>
    </>
  );
}
