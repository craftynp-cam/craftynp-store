import type { CustomDimensions, OrderedSizeInches } from "@craftynp/types";

export const PRICE_QUOTE_DEBOUNCE_MS = 350;

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
