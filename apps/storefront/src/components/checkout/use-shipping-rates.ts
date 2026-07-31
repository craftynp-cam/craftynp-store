"use client";

import { useEffect, useRef, useState } from "react";

import type { ShippingRate } from "@craftynp/types";

import type { Cart } from "@/lib/cart";
import type { CheckoutDraft } from "@/lib/checkout";
import { patchCheckoutDraft } from "@/lib/checkout-draft";
import {
  cheapestRateId,
  isDestinationReadyForRates,
  SHIPPING_RATE_DEBOUNCE_MS,
  shippingRateDraftPatch,
  shippingRateKey,
} from "@/lib/shipping-rates";
import {
  readCachedShippingRates,
  writeCachedShippingRates,
} from "@/lib/shipping-rates-cache";

export type ShippingRatesStatus = "idle" | "loading" | "ready" | "error";

export type ShippingRatesState = {
  status: ShippingRatesStatus;
  rates: readonly ShippingRate[];
  error: string | null;
  retry: () => void;
};

type ShippingRatesResponseBody = {
  rates: ShippingRate[];
};

type FetchState = {
  key: string;
  status: "loading" | "ready" | "error";
  rates: readonly ShippingRate[];
  error: string | null;
};

const UNAVAILABLE_MESSAGE =
  "We couldn't get a shipping rate for your address right now.";

function preselectRate(rates: readonly ShippingRate[], currentRateId: string) {
  const stillValid = rates.some((rate) => rate.rateId === currentRateId);
  const rateId = stillValid ? currentRateId : cheapestRateId(rates);
  const rate = rates.find((candidate) => candidate.rateId === rateId);
  if (!rate) return;

  patchCheckoutDraft(shippingRateDraftPatch(rate));
}

export function useShippingRates(
  draft: CheckoutDraft,
  cart: Cart,
): ShippingRatesState {
  const [fetchState, setFetchState] = useState<FetchState | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const preselectedKeyRef = useRef<string | null>(null);
  const activeKeyRef = useRef<string | null>(null);

  const ready = isDestinationReadyForRates(draft);
  const key = ready ? shippingRateKey(draft, cart) : null;
  const cachedRates = key ? readCachedShippingRates(key) : null;

  const latestRef = useRef({ draft, cart });

  useEffect(() => {
    latestRef.current = { draft, cart };
  });

  useEffect(() => {
    if (!key) return;

    if (cachedRates) {
      if (preselectedKeyRef.current !== key) {
        preselectedKeyRef.current = key;
        preselectRate(cachedRates, latestRef.current.draft.shippingRateId);
      }
      return;
    }

    if (activeKeyRef.current === key) return;
    activeKeyRef.current = key;

    const controller = new AbortController();

    const timer = setTimeout(() => {
      setFetchState({ key, status: "loading", rates: [], error: null });

      const { draft: latestDraft, cart: latestCart } = latestRef.current;

      fetch("/checkout/shipping-rates", {
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
        }),
        signal: controller.signal,
      })
        .then((response) => {
          if (!response.ok) throw new Error("rates_unavailable");
          return response.json() as Promise<ShippingRatesResponseBody>;
        })
        .then((body) => {
          writeCachedShippingRates(key, body.rates);
          preselectedKeyRef.current = key;
          setFetchState({
            key,
            status: "ready",
            rates: body.rates,
            error: null,
          });
          preselectRate(body.rates, latestRef.current.draft.shippingRateId);
        })
        .catch((error: unknown) => {
          if (error instanceof Error && error.name === "AbortError") return;
          setFetchState({
            key,
            status: "error",
            rates: [],
            error: UNAVAILABLE_MESSAGE,
          });
        });
    }, SHIPPING_RATE_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
      if (activeKeyRef.current === key) activeKeyRef.current = null;
    };
  }, [key, retryToken, cachedRates]);

  const retry = () => setRetryToken((token) => token + 1);

  if (!key) {
    return { status: "idle", rates: [], error: null, retry };
  }

  if (cachedRates) {
    return { status: "ready", rates: cachedRates, error: null, retry };
  }

  if (!fetchState || fetchState.key !== key) {
    return { status: "loading", rates: [], error: null, retry };
  }

  return {
    status: fetchState.status,
    rates: fetchState.rates,
    error: fetchState.error,
    retry,
  };
}
