import {
  readOptionValueHeightInches,
  readOptionValueWidthInches,
  resolveArtworkMinDpi,
  resolveProductCustomization,
} from "@craftynp/types";
import type {
  LineItemOption,
  OrderedSizeInches,
  ProductCustomization,
} from "@craftynp/types";

import type { CustomizationRules } from "./validate-customization";

export type VariantWithCustomization = {
  id: string;
  product?: {
    metadata?: Record<string, unknown> | null;
    categories?:
      ({ metadata?: Record<string, unknown> | null } | null)[] | null;
    options?: ({ id?: string | null } | null)[] | null;
    product_options?:
      | ({
          product_option?: { title?: string | null } | null;
          values?: ({ value?: string | null } | null)[] | null;
        } | null)[]
      | null;
  } | null;
  options?:
    | ({
        value?: string | null;
        option_id?: string | null;
        metadata?: Record<string, unknown> | null;
        option?: { title?: string | null } | null;
      } | null)[]
    | null;
};

export const VARIANT_CUSTOMIZATION_FIELDS = [
  "id",
  "product.metadata",
  "product.categories.metadata",
  "product.options.id",
  "product.product_options.product_option.title",
  "product.product_options.values.value",
  "options.value",
  "options.option_id",
  "options.metadata",
  "options.option.title",
];

export type OrderLineFacts = {
  isCustomizable: boolean;
  options: LineItemOption[];
  sizeOptionTitle: string | null;
};

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

function isCustomSizeVariant(
  variant: VariantWithCustomization,
  { inputs, size }: ProductCustomization,
): boolean | null {
  if (inputs.dimensions === "off") return null;
  if (size.optionTitle === null || size.optionValue === null) return null;

  const productOptions = variant.product?.product_options ?? [];
  const productLacksIt =
    productOptions.length > 0 &&
    !productOptions.some(
      (productOption) =>
        productOption?.product_option?.title === size.optionTitle &&
        (productOption.values ?? []).some(
          (value) => value?.value === size.optionValue,
        ),
    );
  if (productLacksIt) return null;

  return (variant.options ?? []).some(
    (option) =>
      option?.option?.title === size.optionTitle &&
      option.value === size.optionValue,
  );
}

export function customizationRulesForVariant(
  variant: VariantWithCustomization,
): CustomizationRules {
  const customization = resolveProductCustomization(variant.product?.metadata);
  const customSizeVariant = isCustomSizeVariant(variant, customization);

  return {
    inputs: customization.inputs,
    customSizeVariant,
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

function productOptionRank(variant: VariantWithCustomization) {
  const ids = (variant.product?.options ?? []).map((option) => option?.id);

  return (optionId: string | null | undefined) => {
    const index = optionId ? ids.indexOf(optionId) : -1;
    return index === -1 ? ids.length : index;
  };
}

export function orderLineFactsForVariant(
  variant: VariantWithCustomization,
): OrderLineFacts {
  const customization = resolveProductCustomization(variant.product?.metadata);
  const rank = productOptionRank(variant);

  return {
    isCustomizable: customization.isCustomizable,
    options: [...(variant.options ?? [])]
      .sort((a, b) => rank(a?.option_id) - rank(b?.option_id))
      .flatMap((option) =>
        option?.option?.title && option.value != null
          ? [{ title: option.option.title, value: option.value }]
          : [],
      ),
    sizeOptionTitle: customization.size.optionTitle,
  };
}
