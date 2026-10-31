import type { CustomDimensions, OrderedSizeInches } from "@craftynp/types";

import type { CartLine } from "./cart";

export const PRICE_QUOTE_DEBOUNCE_MS = 350;

export const PRICE_QUOTE_REFRESH_MARGIN_MS = 2 * 60 * 1000;

export function quotedDimensions(
  usesCustomSize: boolean,
  size: OrderedSizeInches,
): CustomDimensions | undefined {
  // Only a custom size is area-priced. A preset's measurements exist for the
  // artwork resolution check and must not turn into a price of their own.
  if (!usesCustomSize) return undefined;
  if (size.widthInches == null || size.heightInches == null) return undefined;
  return { widthInches: size.widthInches, heightInches: size.heightInches };
}

export function priceQuoteKey(
  variantId: string,
  quantity: number,
  dimensions: CustomDimensions | undefined,
): string {
  return [
    variantId,
    quantity,
    dimensions?.widthInches ?? "",
    dimensions?.heightInches ?? "",
  ].join("|");
}

export function priceQuoteExpiry(token: string): number | null {
  const [payload, signature, ...rest] = token.split(".");
  if (!payload || !signature || rest.length > 0) return null;

  try {
    const decoded: unknown = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/")),
    );
    const exp = (decoded as { exp?: unknown } | null)?.exp;
    return typeof exp === "number" && Number.isFinite(exp) ? exp : null;
  } catch {
    return null;
  }
}

export function needsFreshPriceQuote(
  line: Pick<CartLine, "priceQuoteToken" | "customization">,
  nowMs: number,
): boolean {
  if (!line.customization?.dimensions) return false;
  if (!line.priceQuoteToken) return true;

  const exp = priceQuoteExpiry(line.priceQuoteToken);
  return exp === null || exp - PRICE_QUOTE_REFRESH_MARGIN_MS <= nowMs;
}
