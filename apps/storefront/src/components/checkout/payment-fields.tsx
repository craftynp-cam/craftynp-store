"use client";

import { useImperativeHandle, type Ref } from "react";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe, type Stripe as StripeJs } from "@stripe/stripe-js";

let stripePromise: Promise<StripeJs | null> | null = null;

function getStripe(): Promise<StripeJs | null> {
  if (!stripePromise) {
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
    stripePromise = loadStripe(publishableKey);
  }
  return stripePromise;
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

export type PaymentFieldsProps = {
  clientSecret: string;
  submitRef: Ref<PaymentSubmitHandle>;
};

export function PaymentFields({ clientSecret, submitRef }: PaymentFieldsProps) {
  return (
    <Elements stripe={getStripe()} options={{ clientSecret }}>
      <PaymentElement />
      <PaymentSubmitBridge ref={submitRef} />
    </Elements>
  );
}
