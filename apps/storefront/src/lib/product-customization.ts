import {
  ARTWORK_ACCEPTED_LABEL,
  CUSTOMIZATION_INPUTS,
  checkArtworkResolution,
  checkCustomDimensions,
  requiredCustomizationInputs,
  requiredPixelWidth,
} from "@craftynp/types";
import type {
  CustomDimensionErrors,
  CustomizationInputKey,
  ProductCustomization,
} from "@craftynp/types";

import { ARTWORK_SIZE_LIMIT_LABEL } from "./artwork-upload";
import type { ArtworkReference } from "./artwork-upload";
import type { CartLineDetail } from "./cart";
import type { ProductDetailOption, ProductDetailOptionValue } from "./product";

export type CustomizationDraft = {
  artwork: ArtworkReference | null;
  customText: string;
  useCustomSize: boolean;
  widthInches: string;
  heightInches: string;
  orderNotes: string;
};

export const EMPTY_CUSTOMIZATION_DRAFT: CustomizationDraft = {
  artwork: null,
  customText: "",
  useCustomSize: false,
  widthInches: "",
  heightInches: "",
  orderNotes: "",
};

export type CustomSizeOption = {
  option: ProductDetailOption;
  customValue: ProductDetailOptionValue;
};

export function resolveCustomSizeOption(
  options: readonly ProductDetailOption[],
  customization: ProductCustomization,
): CustomSizeOption | null {
  const { optionTitle, optionValue } = customization.size;
  if (optionTitle === null || optionValue === null) return null;

  const option = options.find((candidate) => candidate.title === optionTitle);
  const customValue = option?.values.find(
    (candidate) => candidate.value === optionValue,
  );

  return option && customValue ? { option, customValue } : null;
}

export function isCustomSizeOffered(
  customization: ProductCustomization,
): boolean {
  return customization.inputs.dimensions === "optional";
}

export function usesCustomSize(
  customization: ProductCustomization,
  draft: CustomizationDraft,
): boolean {
  if (customization.inputs.dimensions === "off") return false;
  return isCustomSizeOffered(customization) ? draft.useCustomSize : true;
}

export function customSizeErrors(
  customization: ProductCustomization,
  draft: CustomizationDraft,
): CustomDimensionErrors {
  if (!usesCustomSize(customization, draft)) return {};

  const widthInches = positiveNumber(draft.widthInches);
  const heightInches = positiveNumber(draft.heightInches);
  const errors: CustomDimensionErrors = {};

  if (draft.widthInches.trim() !== "" && widthInches === null) {
    errors.widthInches = "Enter a width in inches, like 8.5.";
  }
  if (draft.heightInches.trim() !== "" && heightInches === null) {
    errors.heightInches = "Enter a height in inches, like 10.";
  }
  if (widthInches === null || heightInches === null) return errors;

  return checkCustomDimensions(
    { widthInches, heightInches },
    customization.size,
  );
}

function positiveNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function isSatisfied(
  key: CustomizationInputKey,
  customization: ProductCustomization,
  draft: CustomizationDraft,
) {
  switch (key) {
    case "artwork":
      return draft.artwork != null;
    case "customText":
      return draft.customText.trim() !== "";
    case "dimensions":
      return (
        usesCustomSize(customization, draft) &&
        positiveNumber(draft.widthInches) != null &&
        positiveNumber(draft.heightInches) != null &&
        Object.keys(customSizeErrors(customization, draft)).length === 0
      );
    case "orderNotes":
      return draft.orderNotes.trim() !== "";
  }
}

export function missingRequiredInputs(
  customization: ProductCustomization,
  draft: CustomizationDraft,
): CustomizationInputKey[] {
  const asked = new Set<CustomizationInputKey>(
    requiredCustomizationInputs(customization),
  );
  if (usesCustomSize(customization, draft)) asked.add("dimensions");

  return CUSTOMIZATION_INPUTS.filter(
    (input) =>
      asked.has(input.key) && !isSatisfied(input.key, customization, draft),
  ).map((input) => input.key);
}

const MISSING_LABELS: Record<CustomizationInputKey, string> = {
  artwork: "your artwork",
  customText: "your custom text",
  dimensions: "a width and height",
  orderNotes: "your order notes",
};

export function missingInputLabels(
  missing: readonly CustomizationInputKey[],
): string[] {
  return missing.map((key) => MISSING_LABELS[key]);
}

export function customizationDetails(
  customization: ProductCustomization,
  draft: CustomizationDraft,
): CartLineDetail[] {
  const details: CartLineDetail[] = [];
  if (!customization.isCustomizable) return details;

  if (
    customization.inputs.customText !== "off" &&
    isSatisfied("customText", customization, draft)
  ) {
    details.push({ label: "Custom text", value: draft.customText.trim() });
  }

  if (
    customization.inputs.dimensions !== "off" &&
    isSatisfied("dimensions", customization, draft)
  ) {
    details.push({
      label: "Size",
      value: `${draft.widthInches.trim()}\u2033 \u00d7 ${draft.heightInches.trim()}\u2033`,
    });
  }

  if (
    customization.inputs.orderNotes !== "off" &&
    isSatisfied("orderNotes", customization, draft)
  ) {
    details.push({ label: "Order notes", value: draft.orderNotes.trim() });
  }

  return details;
}

// The physical width the artwork will be printed at. A custom size is whatever
// the shopper typed; a preset carries its width on the Medusa option value's
// own metadata, and the selector is deliberately not told which group is the
// size, so any selected value that names one answers.
export function orderedWidthInches(
  customization: ProductCustomization,
  draft: CustomizationDraft,
  options: readonly ProductDetailOption[],
  selected: Record<string, string>,
): number | null {
  if (usesCustomSize(customization, draft)) {
    return positiveNumber(draft.widthInches);
  }

  for (const option of options) {
    const value = option.values.find(
      (candidate) => candidate.id === selected[option.id],
    );
    if (value?.widthInches != null) return value.widthInches;
  }

  return null;
}

// A file below the floor blocks whatever the declared artwork mode is:
// `optional` says the shopper need not supply artwork, not that a file too
// coarse to print is acceptable once they have.
export function artworkResolutionError(
  draft: CustomizationDraft,
  minDpi: number,
  widthInches: number | null,
): string | null {
  if (draft.artwork === null) return null;

  const result = checkArtworkResolution(draft.artwork, {
    minDpi,
    orderedWidthInches: widthInches,
  });

  return result.ok ? null : result.message;
}

export function artworkGuidance(
  minDpi: number,
  widthInches: number | null,
): string {
  const formats = `${ARTWORK_ACCEPTED_LABEL}, up to ${ARTWORK_SIZE_LIMIT_LABEL}.`;
  if (widthInches === null) return formats;

  const pixels = requiredPixelWidth(minDpi, widthInches).toLocaleString(
    "en-US",
  );
  return `${formats} At ${widthInches}\u2033 wide we need at least ${pixels} pixels across (${minDpi} DPI).`;
}
