"use client";

import { useEffect, useRef, useState } from "react";

import type { Cart } from "@/lib/cart";
import type { CheckoutDraft } from "@/lib/checkout";
import { patchCheckoutDraft } from "@/lib/checkout-draft";
import {
  isDestinationReadyForTax,
  TAX_QUOTE_DEBOUNCE_MS,
  taxQuoteKey,
} from "@/lib/tax-quote";
import {
  readCachedTaxQuote,
  writeCachedTaxQuote,
  type CachedTaxQuote,
} from "@/lib/tax-quote-cache";

export type TaxQuoteStatus = "idle" | "loading" | "ready" | "error";

export type TaxQuoteState = {
  status: TaxQuoteStatus;
  taxAmount: number | null;
  currencyCode: string | null;
  error: string | null;
  retry: () => void;
};

type FetchState = {
  key: string;
  status: "loading" | "ready" | "error";
  quote: CachedTaxQuote | null;
  error: string | null;
};

const UNAVAILABLE_MESSAGE =
  "We couldn't calculate tax for your address right now.";

function commitQuote(quote: CachedTaxQuote) {
  patchCheckoutDraft({
    taxAmount: quote.taxAmount,
    taxCurrency: quote.currencyCode,
    taxQuoteToken: quote.quoteToken,
  });
}

export function useTaxQuote(
  draft: CheckoutDraft,
  cart: Cart,
  shippingReady: boolean,
): TaxQuoteState {
  const [fetchState, setFetchState] = useState<FetchState | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const committedKeyRef = useRef<string | null>(null);
  const activeKeyRef = useRef<string | null>(null);

  const ready = isDestinationReadyForTax(draft, shippingReady);
  const key = ready ? taxQuoteKey(draft, cart) : null;
  const cachedQuote = key ? readCachedTaxQuote(key) : null;

  const latestRef = useRef({ draft, cart });

  useEffect(() => {
    latestRef.current = { draft, cart };
  });

  useEffect(() => {
    if (!key) return;

    if (cachedQuote) {
      if (committedKeyRef.current !== key) {
        committedKeyRef.current = key;
        commitQuote(cachedQuote);
      }
      return;
    }

    if (activeKeyRef.current === key) return;
    activeKeyRef.current = key;

    const controller = new AbortController();

    const timer = setTimeout(() => {
      setFetchState({ key, status: "loading", quote: null, error: null });

      const { draft: latestDraft, cart: latestCart } = latestRef.current;

      fetch("/checkout/tax", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: {
            countryCode: latestDraft.countryCode,
            postalCode: latestDraft.postalCode,
            city: latestDraft.city,
            state: latestDraft.state,
          },
          items: latestCart.lines.map((line) => ({
            variantId: line.id,
            quantity: line.quantity,
          })),
          shippingQuoteToken: latestDraft.shippingQuoteToken,
        }),
        signal: controller.signal,
      })
        .then((response) => {
          if (!response.ok) throw new Error("tax_unavailable");
          return response.json() as Promise<CachedTaxQuote>;
        })
        .then((quote) => {
          writeCachedTaxQuote(key, quote);
          committedKeyRef.current = key;
          setFetchState({ key, status: "ready", quote, error: null });
          commitQuote(quote);
        })
        .catch((error: unknown) => {
          if (error instanceof Error && error.name === "AbortError") return;
          setFetchState({
            key,
            status: "error",
            quote: null,
            error: UNAVAILABLE_MESSAGE,
          });
        });
    }, TAX_QUOTE_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
      if (activeKeyRef.current === key) activeKeyRef.current = null;
    };
  }, [key, retryToken, cachedQuote]);

  const retry = () => setRetryToken((token) => token + 1);

  if (!key) {
    return {
      status: "idle",
      taxAmount: null,
      currencyCode: null,
      error: null,
      retry,
    };
  }

  if (cachedQuote) {
    return {
      status: "ready",
      taxAmount: cachedQuote.taxAmount,
      currencyCode: cachedQuote.currencyCode,
      error: null,
      retry,
    };
  }

  if (!fetchState || fetchState.key !== key) {
    return {
      status: "loading",
      taxAmount: null,
      currencyCode: null,
      error: null,
      retry,
    };
  }

  return {
    status: fetchState.status,
    taxAmount: fetchState.quote?.taxAmount ?? null,
    currencyCode: fetchState.quote?.currencyCode ?? null,
    error: fetchState.error,
    retry,
  };
}
