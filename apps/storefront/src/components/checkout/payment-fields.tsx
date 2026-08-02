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
