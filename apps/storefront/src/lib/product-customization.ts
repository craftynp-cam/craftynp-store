import { CUSTOMIZATION_INPUTS } from "@craftynp/types";
import type {
  CustomizationInputKey,
  ProductCustomization,
} from "@craftynp/types";

import type { ArtworkReference } from "./artwork-upload";

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
  if (!customization.isCustomizable) return [];

  return CUSTOMIZATION_INPUTS.filter(
    (input) =>
      customization.inputs[input.key] === "required" &&
      !isSatisfied(input.key, draft),
  ).map((input) => input.key);
}

const MISSING_LABELS: Record<CustomizationInputKey, string> = {
  artwork: "your artwork",
  customText: "your custom text",
  dimensions: "a width and height",
  orderNotes: "your order notes",
};

export function missingInputsMessage(
  missing: readonly CustomizationInputKey[],
): string | null {
  if (missing.length === 0) return null;

  const labels = missing.map((key) => MISSING_LABELS[key]);
  const last = labels[labels.length - 1];
  const listed =
    labels.length === 1
      ? last
      : `${labels.slice(0, -1).join(", ")} and ${last}`;

  return `Add ${listed} to continue.`;
}
