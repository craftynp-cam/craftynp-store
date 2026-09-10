import {
  ARTWORK_ACCEPTED_LABEL,
  CUSTOMIZATION_INPUTS,
  CUSTOM_TEXT_MAX_LENGTH,
  artworkResolutionDemands,
  checkArtworkResolution,
  checkCustomDimensions,
  requiredCustomizationInputs,
} from "@craftynp/types";
import type {
  CustomDimensionErrors,
  CustomizationInputKey,
  CustomizationInputMode,
  OrderedSizeInches,
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

// The trimmed length is what the shopper is judged on, because the trimmed
// value is what customTextSchema stores. Counting the raw string would refuse
// text the backend accepts.
export function customTextLength(value: string): number {
  return value.trim().length;
}

export function customTextError(
  customization: ProductCustomization,
  draft: CustomizationDraft,
): string | null {
  if (customization.inputs.customText === "off") return null;

  const over = customTextLength(draft.customText) - CUSTOM_TEXT_MAX_LENGTH;
  if (over <= 0) return null;

  return `Shorten this to ${CUSTOM_TEXT_MAX_LENGTH} characters or fewer \u2014 ${over} ${over === 1 ? "character" : "characters"} over.`;
}

// The limit is stated before a shopper reaches it and counted while they type,
// which is the whole reason the input carries no maxLength: refusing keystrokes
// silently is how a shopper loses the end of a sentence without being told.
export function customTextHint(
  mode: CustomizationInputMode,
  value: string,
): string {
  const prefix = mode === "optional" ? "Optional. " : "";
  const used = customTextLength(value);

  return used === 0
    ? `${prefix}Up to ${CUSTOM_TEXT_MAX_LENGTH} characters.`
    : `${prefix}${used} of ${CUSTOM_TEXT_MAX_LENGTH} characters used.`;
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

// The physical size the artwork will be printed at. A custom size is whatever
// the shopper typed; a preset carries its measurements on the Medusa option
// value's own metadata, and the selector is deliberately not told which group
// is the size, so any selected value that names them answers.
export function orderedSizeInches(
  customization: ProductCustomization,
  draft: CustomizationDraft,
  options: readonly ProductDetailOption[],
  selected: Record<string, string>,
): OrderedSizeInches {
  if (usesCustomSize(customization, draft)) {
    return {
      widthInches: positiveNumber(draft.widthInches),
      heightInches: positiveNumber(draft.heightInches),
    };
  }

  for (const option of options) {
    const value = option.values.find(
      (candidate) => candidate.id === selected[option.id],
    );
    if (value?.widthInches != null || value?.heightInches != null) {
      return {
        widthInches: value.widthInches ?? null,
        heightInches: value.heightInches ?? null,
      };
    }
  }

  return { widthInches: null, heightInches: null };
}

// A file below the floor blocks whatever the declared artwork mode is:
// `optional` says the shopper need not supply artwork, not that a file too
// coarse to print is acceptable once they have.
export function artworkResolutionError(
  draft: CustomizationDraft,
  minDpi: number,
  size: OrderedSizeInches,
): string | null {
  if (draft.artwork === null) return null;

  const result = checkArtworkResolution(draft.artwork, { minDpi, ...size });

  return result.ok ? null : result.message;
}

export function artworkGuidance(
  minDpi: number,
  size: OrderedSizeInches,
): string {
  const formats = `${ARTWORK_ACCEPTED_LABEL}, up to ${ARTWORK_SIZE_LIMIT_LABEL}.`;

  // Quote the axis that asks the most of the file, so clearing the stated
  // number is enough rather than only necessary.
  const demands = artworkResolutionDemands(
    { mimeType: "image/png", widthPx: 1, heightPx: 1 },
    size,
    minDpi,
  );
  const hardest = demands.reduce<(typeof demands)[number] | null>(
    (most, demand) =>
      most === null || demand.requiredPx > most.requiredPx ? demand : most,
    null,
  );
  if (hardest === null) return formats;

  const extent = hardest.axis === "width" ? "wide" : "tall";
  const direction = hardest.axis === "width" ? "across" : "down";
  const pixels = hardest.requiredPx.toLocaleString("en-US");

  return `${formats} At ${hardest.inches}\u2033 ${extent} we need at least ${pixels} pixels ${direction} (${minDpi} DPI).`;
}
