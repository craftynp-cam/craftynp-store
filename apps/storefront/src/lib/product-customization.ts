import {
  checkCustomDimensions,
  requiredCustomizationInputs,
} from "@craftynp/types";
import type {
  CustomDimensionErrors,
  CustomizationInputKey,
  ProductCustomization,
} from "@craftynp/types";

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
  return requiredCustomizationInputs(customization).filter(
    (key) => !isSatisfied(key, customization, draft),
  );
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
