"use client";

import { useEffect, useRef, useState } from "react";

import type { CheckoutLineRefusal, PriceQuoteResponse } from "@craftynp/types";

import { setCartLineQuote, type Cart, type CartLine } from "@/lib/cart";
import type { CheckoutDraft } from "@/lib/checkout";
import { patchCheckoutDraft } from "@/lib/checkout-draft";
import {
  isRequotableRefusal,
  lineProblems,
  refusalsFromBody,
  type CheckoutLineProblem,
} from "@/lib/checkout-refusal";
import {
  isReadyForPayment,
  PAYMENT_PREPARE_DEBOUNCE_MS,
  paymentPrepareKey,
  type PaymentSessionStatus,
} from "@/lib/payment";
import { needsFreshPriceQuote } from "@/lib/price-quote";

export type PaymentSessionState = {
  status: PaymentSessionStatus;
  clientSecret: string | null;
  error: string | null;
  refusals: readonly CheckoutLineProblem[];
  retry: () => void;
};

type FetchState = {
  key: string;
  status: "loading" | "ready" | "error";
  clientSecret: string | null;
  error: string | null;
  refusals: readonly CheckoutLineProblem[];
};

type PrepareOutcome =
  | { kind: "ready"; cartId: string; clientSecret: string }
  | { kind: "refused"; refusals: readonly CheckoutLineProblem[] };

const UNAVAILABLE_MESSAGE =
  "We couldn't set up payment for this order right now.";

const NO_REFUSALS: readonly CheckoutLineProblem[] = [];

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

async function requoteLine(
  line: CartLine,
  signal: AbortSignal,
): Promise<CartLine> {
  const dimensions = line.customization?.dimensions;
  if (!dimensions) return line;

  const response = await fetch("/checkout/price-quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      variantId: line.id,
      quantity: line.quantity,
      dimensions,
    }),
    signal,
  });
  if (!response.ok) throw new Error("price_unavailable");

  const quote = (await response.json()) as PriceQuoteResponse;
  const fresh = {
    priceQuoteToken: quote.quoteToken,
    unitPrice: quote.unitAmount,
  };
  setCartLineQuote(line.lineId, { quantity: line.quantity, dimensions }, fresh);

  return { ...line, ...fresh };
}

async function requoteLines(
  lines: readonly CartLine[],
  shouldRequote: (line: CartLine, index: number) => boolean,
  signal: AbortSignal,
): Promise<CartLine[]> {
  const refreshed: CartLine[] = [];

  for (const [index, line] of lines.entries()) {
    refreshed.push(
      shouldRequote(line, index) ? await requoteLine(line, signal) : line,
    );
  }

  return refreshed;
}

function postPrepare(
  draft: CheckoutDraft,
  lines: readonly CartLine[],
  signal: AbortSignal,
): Promise<Response> {
  return fetch("/checkout/prepare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cartId: draft.cartId || undefined,
      email: draft.email,
      shippingAddress: toAddressPayload(draft, ""),
      billingAddress: draft.billingSameAsDelivery
        ? toAddressPayload(draft, "")
        : toAddressPayload(draft, "billing"),
      items: lines.map((line) => ({
        variantId: line.id,
        quantity: line.quantity,
        priceQuoteToken: line.priceQuoteToken,
        customization: line.customization,
      })),
      shippingRateId: draft.shippingRateId,
      shippingServiceCode: draft.shippingServiceCode,
      shippingQuoteToken: draft.shippingQuoteToken,
      taxQuoteToken: draft.taxQuoteToken,
    }),
    signal,
  });
}

async function readRefusals(
  response: Response,
): Promise<CheckoutLineRefusal[] | null> {
  if (response.status !== 400) return null;
  return refusalsFromBody(await response.json().catch(() => null));
}

async function preparePayment(
  draft: CheckoutDraft,
  cart: Cart,
  signal: AbortSignal,
): Promise<PrepareOutcome> {
  let lines = await requoteLines(
    cart.lines,
    (line) => needsFreshPriceQuote(line, Date.now()),
    signal,
  );
  let response = await postPrepare(draft, lines, signal);
  let refusals = await readRefusals(response);

  const requotable = new Set(
    refusals?.filter(isRequotableRefusal).map((refusal) => refusal.line),
  );

  if (requotable.size > 0) {
    lines = await requoteLines(
      lines,
      (_line, index) => requotable.has(index),
      signal,
    );
    response = await postPrepare(draft, lines, signal);
    refusals = await readRefusals(response);
  }

  const problems = refusals ? lineProblems(lines, refusals) : null;
  if (problems) return { kind: "refused", refusals: problems };

  if (!response.ok) throw new Error("checkout_unavailable");

  const result = (await response.json()) as {
    cartId: string;
    clientSecret: string;
  };
  return { kind: "ready", ...result };
}

export function usePaymentSession(
  draft: CheckoutDraft,
  cart: Cart,
  taxReady: boolean,
): PaymentSessionState {
  const [fetchState, setFetchState] = useState<FetchState | null>(null);
  const [retryToken, setRetryToken] = useState(0);
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
        refusals: NO_REFUSALS,
      });

      const { draft: latestDraft, cart: latestCart } = latestRef.current;

      preparePayment(latestDraft, latestCart, controller.signal)
        .then((outcome) => {
          if (outcome.kind === "refused") {
            setFetchState({
              key,
              status: "error",
              clientSecret: null,
              error: null,
              refusals: outcome.refusals,
            });
            return;
          }

          setFetchState({
            key,
            status: "ready",
            clientSecret: outcome.clientSecret,
            error: null,
            refusals: NO_REFUSALS,
          });
          patchCheckoutDraft({
            cartId: outcome.cartId,
            paymentClientSecret: outcome.clientSecret,
          });
        })
        .catch((error: unknown) => {
          if (error instanceof Error && error.name === "AbortError") return;
          setFetchState({
            key,
            status: "error",
            clientSecret: null,
            error: UNAVAILABLE_MESSAGE,
            refusals: NO_REFUSALS,
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
    return {
      status: "idle",
      clientSecret: null,
      error: null,
      refusals: NO_REFUSALS,
      retry,
    };
  }

  if (!fetchState || fetchState.key !== key) {
    return {
      status: "loading",
      clientSecret: null,
      error: null,
      refusals: NO_REFUSALS,
      retry,
    };
  }

  return {
    status: fetchState.status,
    clientSecret: fetchState.clientSecret,
    error: fetchState.error,
    refusals: fetchState.refusals,
    retry,
  };
}
