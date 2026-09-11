import {
  ARTWORK_ACCEPTED_LABEL,
  CUSTOMIZATION_INPUTS,
  ORDER_NOTES_MAX_LENGTH,
  artworkResolutionDemands,
  checkArtworkResolution,
  checkCustomDimensions,
  checkSingleLine,
  checkTextLength,
  requiredCustomizationInputs,
  textLength,
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

// What is wrong with a text field, in the field's words and in the one
// add-to-cart hint's. They travel together because the hint has to name what
// the shopper must actually do, and "shorten" is the wrong instruction for a
// line break.
export type TextFieldProblem = {
  message: string;
  clause: string;
};

// Both counted fields measure through @craftynp/types' textLength, which is
// what customTextSchema and the backend validator measure too, so the number
// the shopper is shown is the number they are held to.
export function customTextProblem(
  customization: ProductCustomization,
  draft: CustomizationDraft,
): TextFieldProblem | null {
  if (customization.inputs.customText === "off") return null;

  const singleLine = checkSingleLine(draft.customText);
  if (singleLine !== null) {
    return { message: singleLine, clause: "keep your custom text to one line" };
  }

  const tooLong = checkTextLength(
    draft.customText,
    customization.text.maxLength,
  );
  return tooLong === null
    ? null
    : { message: tooLong, clause: "shorten your custom text" };
}

// Order notes are instructions to the maker rather than something made into
// the piece, so their limit is one number for the whole shop instead of
// product configuration the way the custom text limit is — and unlike custom
// text they may run to as many lines as the shopper wants.
export function orderNotesProblem(
  customization: ProductCustomization,
  draft: CustomizationDraft,
): TextFieldProblem | null {
  if (customization.inputs.orderNotes === "off") return null;

  const tooLong = checkTextLength(draft.orderNotes, ORDER_NOTES_MAX_LENGTH);
  return tooLong === null
    ? null
    : { message: tooLong, clause: "shorten your order notes" };
}

// The limit is stated before the shopper reaches it and counted while they
// type, which is the whole reason neither field carries a maxLength: refusing
// keystrokes silently is how a shopper loses the end of a sentence without
// being told.
export function characterCountHint(
  mode: CustomizationInputMode,
  value: string,
  maxLength: number,
): string {
  const prefix = mode === "optional" ? "Optional. " : "";
  const used = textLength(value);

  return used === 0
    ? `${prefix}Up to ${maxLength} characters.`
    : `${prefix}${used} of ${maxLength} characters used.`;
}

// A count in the field's description is read on demand but never announced,
// so a screen reader reaches the limit without warning. This says so once, on
// the way in — the message does not change per keystroke, so the live region
// speaks at the threshold rather than on every letter, and going over is the
// field error's job to announce.
export function nearLimitAnnouncement(
  value: string,
  maxLength: number,
): string {
  const remaining = maxLength - textLength(value);
  const threshold = Math.min(20, Math.ceil(maxLength / 5));

  return remaining > 0 && remaining <= threshold
    ? `You are close to the ${maxLength}-character limit.`
    : "";
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

// Order notes are the one detail that may carry line breaks, so they are the
// one that has to agree on what a line break is. A Windows textarea submits
// \r\n and a Mac one \n, and cartLineKey builds the cart line's identity out
// of the detail value — the same note typed on two machines would otherwise be
// two lines. Runs of blank lines collapse so a stray Enter does not push the
// rest of the note out of the cart card's clamp.
export function normalizeOrderNotes(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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
    details.push({
      label: "Order notes",
      value: normalizeOrderNotes(draft.orderNotes),
    });
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
