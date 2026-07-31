"use client";

import { useImperativeHandle, useSyncExternalStore, type Ref } from "react";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import {
  loadStripe,
  type Appearance,
  type Stripe as StripeJs,
} from "@stripe/stripe-js";

import { tokenHex, type Mode } from "@/lib/design-tokens";
import { readIsDarkMode, subscribeToIsDarkMode } from "@/lib/theme";

let stripePromise: Promise<StripeJs | null> | null = null;

function getStripe(): Promise<StripeJs | null> {
  if (!stripePromise) {
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
    stripePromise = loadStripe(publishableKey);
  }
  return stripePromise;
}

/**
 * The Payment Element renders in an iframe, so it cannot read this site's
 * `color-scheme`/`light-dark()` tokens itself — Stripe's `appearance` option
 * is the only way to match it to the page. Built from the same resolved hex
 * values `design-tokens.ts` uses everywhere else, rather than a second,
 * hand-picked palette that could drift from the real one.
 */
function stripeAppearance(mode: Mode): Appearance {
  return {
    theme: mode === "dark" ? "night" : "stripe",
    variables: {
      colorPrimary: tokenHex("primary", mode),
      colorBackground: tokenHex("surface", mode),
      colorText: tokenHex("foreground", mode),
      colorTextSecondary: tokenHex("foreground-muted", mode),
      colorTextPlaceholder: tokenHex("foreground-subtle", mode),
      colorDanger: tokenHex("danger-foreground", mode),
      borderRadius: "10px",
    },
    rules: {
      ".Input": { borderColor: tokenHex("border-strong", mode) },
      ".Label": { color: tokenHex("foreground-muted", mode) },
    },
  };
}

function readServerIsDarkMode(): boolean {
  return false;
}

export type ConfirmPaymentResult =
  { status: "success" } | { status: "error"; message: string };

export type PaymentSubmitHandle = {
  confirmPayment: () => Promise<ConfirmPaymentResult>;
};

const UNAVAILABLE_MESSAGE =
  "Payment isn't ready yet. Please wait a moment and try again.";
const GENERIC_DECLINE_MESSAGE = "Your payment could not be processed.";

/**
 * Bridges CheckoutView's form submit to Stripe's confirmPayment, since
 * useStripe/useElements only work inside an Elements descendant while the
 * visible submit button and its validation live in CheckoutView. Renders no
 * DOM of its own — CheckoutView holds the ref and calls confirmPayment()
 * from its own handleSubmit once the non-payment fields validate.
 */
// React 19 accepts `ref` as a plain prop on function components, so this
// skips forwardRef entirely — its ForwardRefExoticComponent return type
// conflicts with the workspace's dual @types/react resolution (18 for the
// Medusa admin, 19 here; see apps/storefront/AGENTS.md's HeroUI section for
// the same underlying trap) in a way a plain component isn't exposed to.
function PaymentSubmitBridge({ ref }: { ref?: Ref<PaymentSubmitHandle> }) {
  const stripe = useStripe();
  const elements = useElements();

  useImperativeHandle(
    ref,
    () => ({
      async confirmPayment(): Promise<ConfirmPaymentResult> {
        if (!stripe || !elements) {
          return { status: "error", message: UNAVAILABLE_MESSAGE };
        }

        const { error } = await stripe.confirmPayment({
          elements,
          redirect: "if_required",
        });

        if (error) {
          return {
            status: "error",
            message: error.message ?? GENERIC_DECLINE_MESSAGE,
          };
        }

        return { status: "success" };
      },
    }),
    [stripe, elements],
  );

  return null;
}

const ELEMENT_LOAD_ERROR_MESSAGE =
  "We couldn't load the payment form. Please try again.";

export type PaymentFieldsProps = {
  clientSecret: string;
  submitRef: Ref<PaymentSubmitHandle>;
  onLoadError?: (message: string) => void;
};

export function PaymentFields({
  clientSecret,
  submitRef,
  onLoadError,
}: PaymentFieldsProps) {
  const isDark = useSyncExternalStore(
    subscribeToIsDarkMode,
    readIsDarkMode,
    readServerIsDarkMode,
  );
  const mode: Mode = isDark ? "dark" : "light";

  return (
    // Stripe's Elements group only reads `options.clientSecret` on its first
    // mount — a changed clientSecret on a later render (e.g. the shopper
    // edits the address after a cart/payment session was already prepared,
    // and a fresh one supersedes it) is silently ignored, leaving the
    // mounted PaymentElement bound to a PaymentIntent that no longer matches
    // reality and surfacing as an "Unhandled payment Element loaderror".
    // Keying on clientSecret forces a clean remount instead.
    <Elements
      key={`${clientSecret}:${mode}`}
      stripe={getStripe()}
      options={{ clientSecret, appearance: stripeAppearance(mode) }}
    >
      <PaymentElement
        onLoadError={(event) => {
          onLoadError?.(event.error.message ?? ELEMENT_LOAD_ERROR_MESSAGE);
        }}
      />
      <PaymentSubmitBridge ref={submitRef} />
    </Elements>
  );
}
