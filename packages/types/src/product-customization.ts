import { z } from "zod";

import type { CustomSizeBounds } from "./customization.js";

export const CUSTOMIZATION_INPUT_MODES = [
  "off",
  "optional",
  "required",
] as const;

export const customizationInputModeSchema = z.enum(CUSTOMIZATION_INPUT_MODES);
export type CustomizationInputMode = z.infer<
  typeof customizationInputModeSchema
>;

export type CustomizationInputKey =
  "artwork" | "customText" | "dimensions" | "orderNotes";

export type CustomizationInput = {
  key: CustomizationInputKey;
  metadataKey: string;
  label: string;
  description: string;
};

export const CUSTOMIZABLE_METADATA_KEY = "customizable";

export const CUSTOMIZATION_INPUTS = [
  {
    key: "artwork",
    metadataKey: "customization_artwork",
    label: "Artwork",
    description: "A photo or design file the shopper uploads.",
  },
  {
    key: "customText",
    metadataKey: "customization_text",
    label: "Custom text",
    description: "One line the shopper wants engraved, printed or stitched.",
  },
  {
    key: "dimensions",
    metadataKey: "customization_size",
    label: "Custom size",
    description: "A width and height in inches the shopper chooses.",
  },
  {
    key: "orderNotes",
    metadataKey: "customization_notes",
    label: "Order notes",
    description: "Anything else the shopper wants to say about this piece.",
  },
] as const satisfies readonly CustomizationInput[];

export const CUSTOM_SIZE_MIN_METADATA_KEY = "customization_size_min_inches";
export const CUSTOM_SIZE_MAX_METADATA_KEY = "customization_size_max_inches";
export const CUSTOM_SIZE_OPTION_METADATA_KEY = "customization_size_option";
export const CUSTOM_SIZE_OPTION_VALUE_METADATA_KEY =
  "customization_size_option_value";

export const CUSTOM_SIZE_FALLBACK_BOUNDS: CustomSizeBounds = {
  minInches: 1,
  maxInches: 96,
};

export type CustomSizeConfig = CustomSizeBounds & {
  optionTitle: string | null;
  optionValue: string | null;
};

export type ProductCustomization = {
  isCustomizable: boolean;
  inputs: Record<CustomizationInputKey, CustomizationInputMode>;
  size: CustomSizeConfig;
};

const NO_INPUTS: Record<CustomizationInputKey, CustomizationInputMode> = {
  artwork: "off",
  customText: "off",
  dimensions: "off",
  orderNotes: "off",
};

const NO_CUSTOM_SIZE: CustomSizeConfig = {
  ...CUSTOM_SIZE_FALLBACK_BOUNDS,
  optionTitle: null,
  optionValue: null,
};

export const READY_MADE_PRODUCT: ProductCustomization = {
  isCustomizable: false,
  inputs: NO_INPUTS,
  size: NO_CUSTOM_SIZE,
};

type Metadata = Record<string, unknown> | null | undefined;

function readFlag(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function readMode(value: unknown): CustomizationInputMode | null {
  const parsed = customizationInputModeSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function isPresent(value: unknown): boolean {
  return value !== undefined && value !== null && value !== "";
}

function readInches(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function readName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function readSizeConfig(metadata: Metadata): CustomSizeConfig {
  const min = readInches(metadata?.[CUSTOM_SIZE_MIN_METADATA_KEY]);
  const max = readInches(metadata?.[CUSTOM_SIZE_MAX_METADATA_KEY]);
  const optionTitle = readName(metadata?.[CUSTOM_SIZE_OPTION_METADATA_KEY]);
  const optionValue = readName(
    metadata?.[CUSTOM_SIZE_OPTION_VALUE_METADATA_KEY],
  );

  const bounds =
    min !== null && max !== null && min < max
      ? { minInches: min, maxInches: max }
      : CUSTOM_SIZE_FALLBACK_BOUNDS;

  return {
    ...bounds,
    optionTitle,
    optionValue: optionTitle === null ? null : optionValue,
  };
}

export function resolveProductCustomization(
  metadata: Metadata,
): ProductCustomization {
  if (readFlag(metadata?.[CUSTOMIZABLE_METADATA_KEY]) !== true) {
    return READY_MADE_PRODUCT;
  }

  const inputs = { ...NO_INPUTS };
  for (const input of CUSTOMIZATION_INPUTS) {
    inputs[input.key] = readMode(metadata?.[input.metadataKey]) ?? "off";
  }

  return { isCustomizable: true, inputs, size: readSizeConfig(metadata) };
}

export function customizationMetadataPatch(
  customization: ProductCustomization,
): Record<string, string> {
  const patch: Record<string, string> = {
    [CUSTOMIZABLE_METADATA_KEY]: String(customization.isCustomizable),
  };

  for (const input of CUSTOMIZATION_INPUTS) {
    patch[input.metadataKey] = customization.isCustomizable
      ? customization.inputs[input.key]
      : "off";
  }

  const { size } = customization;
  const asksForSize =
    customization.isCustomizable && customization.inputs.dimensions !== "off";

  patch[CUSTOM_SIZE_MIN_METADATA_KEY] = asksForSize
    ? String(size.minInches)
    : "";
  patch[CUSTOM_SIZE_MAX_METADATA_KEY] = asksForSize
    ? String(size.maxInches)
    : "";
  patch[CUSTOM_SIZE_OPTION_METADATA_KEY] = asksForSize
    ? (size.optionTitle ?? "")
    : "";
  patch[CUSTOM_SIZE_OPTION_VALUE_METADATA_KEY] = asksForSize
    ? (size.optionValue ?? "")
    : "";

  return patch;
}

export function activeCustomizationInputs(
  customization: ProductCustomization,
): CustomizationInputKey[] {
  if (!customization.isCustomizable) return [];
  return CUSTOMIZATION_INPUTS.filter(
    (input) => customization.inputs[input.key] !== "off",
  ).map((input) => input.key);
}

export function requiredCustomizationInputs(
  customization: ProductCustomization,
): CustomizationInputKey[] {
  if (!customization.isCustomizable) return [];
  return CUSTOMIZATION_INPUTS.filter(
    (input) => customization.inputs[input.key] === "required",
  ).map((input) => input.key);
}

export type ProductCustomizationProblem =
  { ok: true } | { ok: false; message: string };

function validateCustomSizeConfig(
  metadata: Metadata,
  { asksForSize, published }: { asksForSize: boolean; published: boolean },
): ProductCustomizationProblem {
  const bounds = [
    {
      key: CUSTOM_SIZE_MIN_METADATA_KEY,
      raw: metadata?.[CUSTOM_SIZE_MIN_METADATA_KEY],
    },
    {
      key: CUSTOM_SIZE_MAX_METADATA_KEY,
      raw: metadata?.[CUSTOM_SIZE_MAX_METADATA_KEY],
    },
  ] as const;

  for (const bound of bounds) {
    if (isPresent(bound.raw) && readInches(bound.raw) === null) {
      return {
        ok: false,
        message: `${bound.key} must be a positive number of inches`,
      };
    }
  }

  const min = readInches(metadata?.[CUSTOM_SIZE_MIN_METADATA_KEY]);
  const max = readInches(metadata?.[CUSTOM_SIZE_MAX_METADATA_KEY]);

  if (min !== null && max !== null && min >= max) {
    return {
      ok: false,
      message: `${CUSTOM_SIZE_MIN_METADATA_KEY} must be smaller than ${CUSTOM_SIZE_MAX_METADATA_KEY}`,
    };
  }

  const optionTitle = readName(metadata?.[CUSTOM_SIZE_OPTION_METADATA_KEY]);
  const optionValue = readName(
    metadata?.[CUSTOM_SIZE_OPTION_VALUE_METADATA_KEY],
  );

  if (optionValue !== null && optionTitle === null) {
    return {
      ok: false,
      message: `${CUSTOM_SIZE_OPTION_VALUE_METADATA_KEY} needs ${CUSTOM_SIZE_OPTION_METADATA_KEY} to name the option it belongs to`,
    };
  }

  if (published && asksForSize && (min === null || max === null)) {
    return {
      ok: false,
      message: `custom size is on, so ${CUSTOM_SIZE_MIN_METADATA_KEY} and ${CUSTOM_SIZE_MAX_METADATA_KEY} must both be set`,
    };
  }

  return { ok: true };
}

export function validateProductCustomization(
  metadata: Metadata,
  { published }: { published: boolean },
): ProductCustomizationProblem {
  const rawFlag = metadata?.[CUSTOMIZABLE_METADATA_KEY];
  const isCustomizable = rawFlag === undefined ? false : readFlag(rawFlag);

  if (isCustomizable === null) {
    return {
      ok: false,
      message: `${CUSTOMIZABLE_METADATA_KEY} must be "true" or "false"`,
    };
  }

  const declared: CustomizationInputKey[] = [];

  for (const input of CUSTOMIZATION_INPUTS) {
    const raw = metadata?.[input.metadataKey];
    if (raw === undefined) continue;

    const mode = readMode(raw);
    if (mode === null) {
      return {
        ok: false,
        message: `${input.metadataKey} must be one of ${CUSTOMIZATION_INPUT_MODES.join(", ")}`,
      };
    }
    if (mode !== "off") declared.push(input.key);
  }

  const sizeProblem = validateCustomSizeConfig(metadata, {
    asksForSize: declared.includes("dimensions"),
    published,
  });
  if (!sizeProblem.ok) return sizeProblem;

  if (!isCustomizable && declared.length > 0) {
    return {
      ok: false,
      message: `${CUSTOMIZABLE_METADATA_KEY} is off, so no configurator input can be on. Turn off: ${declared.join(", ")}`,
    };
  }

  if (published && isCustomizable && declared.length === 0) {
    return {
      ok: false,
      message:
        "a customizable product must ask for at least one input — turn one on, or set customizable to false",
    };
  }

  return { ok: true };
}
