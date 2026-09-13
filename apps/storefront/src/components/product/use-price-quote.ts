"use client";

import { useEffect, useRef, useState } from "react";

import type { CustomDimensions, PriceQuoteResponse } from "@craftynp/types";

import { PRICE_QUOTE_DEBOUNCE_MS, priceQuoteKey } from "@/lib/price-quote";

export type PriceQuoteStatus = "idle" | "loading" | "ready" | "error";

export type PriceQuoteState = {
  status: PriceQuoteStatus;
  quote: PriceQuoteResponse | null;
};

type FetchState = {
  key: string;
  status: Exclude<PriceQuoteStatus, "idle">;
  quote: PriceQuoteResponse | null;
};

// The price the shopper is shown is the one this backend calculated, never one
// assembled here — that is what makes the number in the cart the number they
// were quoted. Only the fetch lives in the effect; everything the render needs
// is derived, the way artworkResolutionError and the clamped quantity are.
export function usePriceQuote(
  variantId: string | null,
  quantity: number,
  dimensions: CustomDimensions | undefined,
): PriceQuoteState {
  const [fetchState, setFetchState] = useState<FetchState | null>(null);
  const activeKeyRef = useRef<string | null>(null);

  const key =
    variantId === null ? null : priceQuoteKey(variantId, quantity, dimensions);

  const latestRef = useRef({ variantId, quantity, dimensions });
  useEffect(() => {
    latestRef.current = { variantId, quantity, dimensions };
  });

  useEffect(() => {
    if (key === null) return;
    if (activeKeyRef.current === key) return;
    activeKeyRef.current = key;

    const controller = new AbortController();

    const timer = setTimeout(() => {
      setFetchState({ key, status: "loading", quote: null });

      const latest = latestRef.current;

      fetch("/checkout/price-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variantId: latest.variantId,
          quantity: latest.quantity,
          dimensions: latest.dimensions,
        }),
        signal: controller.signal,
      })
        .then((response) => {
          if (!response.ok) throw new Error("price_unavailable");
          return response.json() as Promise<PriceQuoteResponse>;
        })
        .then((quote) => {
          setFetchState({ key, status: "ready", quote });
        })
        .catch((error: unknown) => {
          if (error instanceof Error && error.name === "AbortError") return;
          setFetchState({ key, status: "error", quote: null });
        });
    }, PRICE_QUOTE_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
      if (activeKeyRef.current === key) activeKeyRef.current = null;
    };
  }, [key]);

  if (key === null) return { status: "idle", quote: null };

  // A quote for a configuration the shopper has already moved on from is not
  // this line's price, so it reads as loading rather than as an answer.
  if (fetchState === null || fetchState.key !== key) {
    return { status: "loading", quote: null };
  }

  return { status: fetchState.status, quote: fetchState.quote };
}
