import { z } from "zod";

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

export type ProductCustomization = {
  isCustomizable: boolean;
  inputs: Record<CustomizationInputKey, CustomizationInputMode>;
};

const NO_INPUTS: Record<CustomizationInputKey, CustomizationInputMode> = {
  artwork: "off",
  customText: "off",
  dimensions: "off",
  orderNotes: "off",
};

export const READY_MADE_PRODUCT: ProductCustomization = {
  isCustomizable: false,
  inputs: NO_INPUTS,
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

  return { isCustomizable: true, inputs };
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
