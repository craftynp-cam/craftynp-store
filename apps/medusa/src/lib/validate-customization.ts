import {
  checkArtworkResolution,
  checkCustomDimensions,
  checkTextLength,
  lineItemCustomizationSchema,
  type CustomSizeBounds,
  type LineItemCustomization,
  type OrderedSizeInches,
} from "@craftynp/types";
import { MedusaError } from "@medusajs/framework/utils";

export type CustomizationRules = {
  bounds: CustomSizeBounds;
  // The product's own limit, not a constant: customTextSchema only stops the
  // absolute ceiling, exactly as customDimensionsSchema only stops a negative
  // number of inches.
  textMaxLength: number;
  minDpi: number;
  orderedSize?: Partial<OrderedSizeInches>;
};

function reject(detail: string): never {
  throw new MedusaError(
    MedusaError.Types.INVALID_DATA,
    `Invalid line item customization — ${detail}`,
  );
}

export function validateCustomization(
  input: unknown,
  { bounds, textMaxLength, minDpi, orderedSize }: CustomizationRules,
): LineItemCustomization {
  const result = lineItemCustomizationSchema.safeParse(input);

  if (!result.success) {
    reject(
      result.error.issues
        .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
        .join("; "),
    );
  }

  const { customText, dimensions, artwork } = result.data;

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

  return result.data;
}
