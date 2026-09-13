import {
  CUSTOMIZATION_INPUTS,
  checkArtworkResolution,
  checkCustomDimensions,
  checkTextLength,
  lineItemCustomizationSchema,
  type CustomSizeBounds,
  type CustomizationInputKey,
  type CustomizationInputMode,
  type LineItemCustomization,
  type OrderedSizeInches,
} from "@craftynp/types";
import { MedusaError } from "@medusajs/framework/utils";

export type CustomizationRules = {
  inputs: Record<CustomizationInputKey, CustomizationInputMode>;
  customSizeVariant: boolean | null;
  bounds: CustomSizeBounds;
  // The product's own limit, not a constant: customTextSchema only stops the
  // absolute ceiling, exactly as customDimensionsSchema only stops a negative
  // number of inches.
  textMaxLength: number;
  minDpi: number;
  orderedSize?: Partial<OrderedSizeInches>;
};

export type CustomizationRejectionReason = "missing_required" | "input_off";

export class CustomizationRejection extends MedusaError {
  readonly reason: CustomizationRejectionReason;
  readonly input: CustomizationInputKey;

  constructor(
    reason: CustomizationRejectionReason,
    input: CustomizationInputKey,
  ) {
    super(
      MedusaError.Types.INVALID_DATA,
      `invalid_customization:${reason}:${input}`,
    );
    this.reason = reason;
    this.input = input;
  }
}

function reject(detail: string): never {
  throw new MedusaError(
    MedusaError.Types.INVALID_DATA,
    `Invalid line item customization — ${detail}`,
  );
}

function isSwitchedOff(
  key: CustomizationInputKey,
  { inputs, customSizeVariant }: CustomizationRules,
): boolean {
  if (inputs[key] === "off") return true;
  return key === "dimensions" && customSizeVariant === false;
}

function isRequired(
  key: CustomizationInputKey,
  { inputs, customSizeVariant }: CustomizationRules,
): boolean {
  if (inputs[key] === "required") return true;
  return key === "dimensions" && customSizeVariant === true;
}

export function validateCustomization(
  input: unknown,
  rules: CustomizationRules,
): LineItemCustomization {
  const { bounds, textMaxLength, minDpi, orderedSize } = rules;
  const result = lineItemCustomizationSchema.safeParse(input);

  if (!result.success) {
    reject(
      result.error.issues
        .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
        .join("; "),
    );
  }

  const { orderNotes, ...rest } = result.data;
  const customization: LineItemCustomization = orderNotes ? result.data : rest;

  for (const { key } of CUSTOMIZATION_INPUTS) {
    const present = customization[key] !== undefined;

    if (present && isSwitchedOff(key, rules)) {
      throw new CustomizationRejection("input_off", key);
    }
    if (!present && isRequired(key, rules)) {
      throw new CustomizationRejection("missing_required", key);
    }
  }

  const { customText, dimensions, artwork } = customization;

  if (customText) {
    const detail = checkTextLength(customText.value, textMaxLength);
    if (detail !== null) reject(`customText: ${detail}`);
  }

  if (dimensions) {
    const detail = Object.entries(checkCustomDimensions(dimensions, bounds))
      .map(([field, message]) => `${field}: ${message}`)
      .join("; ");

    if (detail !== "") reject(detail);
  }

  if (artwork) {
    // A preset size carries its measurements on the option value rather than
    // the payload, so the caller may name them; the typed dimensions are the
    // fallback.
    const resolution = checkArtworkResolution(artwork, {
      minDpi,
      widthInches: orderedSize?.widthInches ?? dimensions?.widthInches ?? null,
      heightInches:
        orderedSize?.heightInches ?? dimensions?.heightInches ?? null,
    });

    if (!resolution.ok) reject(`artwork: ${resolution.message}`);
  }

  return customization;
}
