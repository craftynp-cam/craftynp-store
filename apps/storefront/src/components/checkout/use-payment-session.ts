"use client";

import { useEffect, useRef, useState } from "react";

import type { Cart } from "@/lib/cart";
import type { CheckoutDraft } from "@/lib/checkout";
import { patchCheckoutDraft } from "@/lib/checkout-draft";
import {
  isReadyForPayment,
  PAYMENT_PREPARE_DEBOUNCE_MS,
  paymentPrepareKey,
  type PaymentSessionStatus,
} from "@/lib/payment";

export type PaymentSessionState = {
  status: PaymentSessionStatus;
  clientSecret: string | null;
  error: string | null;
  retry: () => void;
};

type FetchState = {
  key: string;
  status: "loading" | "ready" | "error";
  clientSecret: string | null;
  error: string | null;
};

const UNAVAILABLE_MESSAGE =
  "We couldn't set up payment for this order right now.";

function toAddressPayload(draft: CheckoutDraft, prefix: "" | "billing") {
  const field = (name: string) =>
    prefix === "" ? name : `billing${name[0]?.toUpperCase()}${name.slice(1)}`;

  return {
    firstName: draft.firstName,
    lastName: draft.lastName,
    phone: draft.phone,
    address1: draft[field("address1") as keyof CheckoutDraft] as string,
    address2: draft[field("address2") as keyof CheckoutDraft] as string,
    city: draft[field("city") as keyof CheckoutDraft] as string,
    state: draft[field("state") as keyof CheckoutDraft] as string,
    postalCode: draft[field("postalCode") as keyof CheckoutDraft] as string,
    countryCode: draft[field("countryCode") as keyof CheckoutDraft] as string,
  };
}

/**
 * Same derived-key / debounce / AbortController / latestRef structure as
 * use-tax-quote.ts and use-shipping-rates.ts. Gates on the live tax status
 * rather than a draft field for the same staleness reason use-tax-quote.ts
 * documents — see isReadyForPayment in src/lib/payment.ts.
 */
export function usePaymentSession(
  draft: CheckoutDraft,
  cart: Cart,
  taxReady: boolean,
): PaymentSessionState {
  const [fetchState, setFetchState] = useState<FetchState | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const committedKeyRef = useRef<string | null>(null);
  const activeKeyRef = useRef<string | null>(null);

  const ready = isReadyForPayment(draft, taxReady);
  const key = ready ? paymentPrepareKey(draft, cart) : null;

  const latestRef = useRef({ draft, cart });

  useEffect(() => {
    latestRef.current = { draft, cart };
  });

  useEffect(() => {
    if (!key) return;
    if (activeKeyRef.current === key) return;
    activeKeyRef.current = key;

    const controller = new AbortController();

    const timer = setTimeout(() => {
      setFetchState({
        key,
        status: "loading",
        clientSecret: null,
        error: null,
      });

      const { draft: latestDraft, cart: latestCart } = latestRef.current;

      fetch("/checkout/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cartId: latestDraft.cartId || undefined,
          email: latestDraft.email,
          shippingAddress: toAddressPayload(latestDraft, ""),
          billingAddress: latestDraft.billingSameAsDelivery
            ? toAddressPayload(latestDraft, "")
            : toAddressPayload(latestDraft, "billing"),
          items: latestCart.lines.map((line) => ({
            variantId: line.id,
            quantity: line.quantity,
            isCustomizable: line.isCustomizable,
            details: line.details,
          })),
          shippingRateId: latestDraft.shippingRateId,
          shippingServiceCode: latestDraft.shippingServiceCode,
          shippingQuoteToken: latestDraft.shippingQuoteToken,
          taxQuoteToken: latestDraft.taxQuoteToken,
        }),
        signal: controller.signal,
      })
        .then((response) => {
          if (!response.ok) throw new Error("checkout_unavailable");
          return response.json() as Promise<{
            cartId: string;
            clientSecret: string;
          }>;
        })
        .then((result) => {
          committedKeyRef.current = key;
          setFetchState({
            key,
            status: "ready",
            clientSecret: result.clientSecret,
            error: null,
          });
          patchCheckoutDraft({
            cartId: result.cartId,
            paymentClientSecret: result.clientSecret,
          });
        })
        .catch((error: unknown) => {
          if (error instanceof Error && error.name === "AbortError") return;
          setFetchState({
            key,
            status: "error",
            clientSecret: null,
            error: UNAVAILABLE_MESSAGE,
          });
        });
    }, PAYMENT_PREPARE_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
      if (activeKeyRef.current === key) activeKeyRef.current = null;
    };
  }, [key, retryToken]);

  const retry = () => setRetryToken((token) => token + 1);

  if (!key) {
    return { status: "idle", clientSecret: null, error: null, retry };
  }

  if (!fetchState || fetchState.key !== key) {
    return { status: "loading", clientSecret: null, error: null, retry };
  }

  return {
    status: fetchState.status,
    clientSecret: fetchState.clientSecret,
    error: fetchState.error,
    retry,
  };
}
