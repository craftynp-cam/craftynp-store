import {
  readOptionValueHeightInches,
  readOptionValueWidthInches,
  resolveArtworkMinDpi,
  resolveProductCustomization,
} from "@craftynp/types";
import type { OrderedSizeInches } from "@craftynp/types";

import type { CustomizationRules } from "./validate-customization";

export type VariantWithCustomization = {
  id: string;
  product?: {
    metadata?: Record<string, unknown> | null;
    categories?:
      ({ metadata?: Record<string, unknown> | null } | null)[] | null;
  } | null;
  options?: ({ metadata?: Record<string, unknown> | null } | null)[] | null;
};

export const VARIANT_CUSTOMIZATION_FIELDS = [
  "id",
  "product.metadata",
  "product.categories.metadata",
  "options.value",
  "options.metadata",
];

// The payload names a variant, not the option values under it, so a preset
// size's inches are only reachable through the variant's own option values.
// The first value that measures either axis answers, the way the storefront's
// orderedSizeInches does.
function presetSize(variant: VariantWithCustomization): OrderedSizeInches {
  for (const option of variant.options ?? []) {
    if (!option) continue;

    const widthInches = readOptionValueWidthInches(option.metadata);
    const heightInches = readOptionValueHeightInches(option.metadata);
    if (widthInches !== null || heightInches !== null) {
      return { widthInches, heightInches };
    }
  }

  return { widthInches: null, heightInches: null };
}

export function customizationRulesForVariant(
  variant: VariantWithCustomization,
): CustomizationRules {
  const customization = resolveProductCustomization(variant.product?.metadata);

  return {
    bounds: {
      minInches: customization.size.minInches,
      maxInches: customization.size.maxInches,
    },
    textMaxLength: customization.text.maxLength,
    minDpi: resolveArtworkMinDpi(
      (variant.product?.categories ?? []).filter(
        (category) => category != null,
      ),
    ),
    orderedSize: presetSize(variant),
  };
}
