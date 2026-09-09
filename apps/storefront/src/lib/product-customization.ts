import { requiredCustomizationInputs } from "@craftynp/types";
import type {
  CustomizationInputKey,
  ProductCustomization,
} from "@craftynp/types";

import type { ArtworkReference } from "./artwork-upload";
import type { CartLineDetail } from "./cart";

export type CustomizationDraft = {
  artwork: ArtworkReference | null;
  customText: string;
  widthInches: string;
  heightInches: string;
  orderNotes: string;
};

export const EMPTY_CUSTOMIZATION_DRAFT: CustomizationDraft = {
  artwork: null,
  customText: "",
  widthInches: "",
  heightInches: "",
  orderNotes: "",
};

function positiveNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function isSatisfied(key: CustomizationInputKey, draft: CustomizationDraft) {
  switch (key) {
    case "artwork":
      return draft.artwork != null;
    case "customText":
      return draft.customText.trim() !== "";
    case "dimensions":
      return (
        positiveNumber(draft.widthInches) != null &&
        positiveNumber(draft.heightInches) != null
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
    (key) => !isSatisfied(key, draft),
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
    isSatisfied("customText", draft)
  ) {
    details.push({ label: "Custom text", value: draft.customText.trim() });
  }

  if (
    customization.inputs.dimensions !== "off" &&
    isSatisfied("dimensions", draft)
  ) {
    details.push({
      label: "Size",
      value: `${draft.widthInches.trim()}\u2033 \u00d7 ${draft.heightInches.trim()}\u2033`,
    });
  }

  if (
    customization.inputs.orderNotes !== "off" &&
    isSatisfied("orderNotes", draft)
  ) {
    details.push({ label: "Order notes", value: draft.orderNotes.trim() });
  }

  return details;
}
