import {
  checkArtworkResolution,
  checkCustomDimensions,
  lineItemCustomizationSchema,
  type CustomSizeBounds,
  type LineItemCustomization,
} from "@craftynp/types";
import { MedusaError } from "@medusajs/framework/utils";

export type CustomizationRules = {
  bounds: CustomSizeBounds;
  minDpi: number;
  orderedWidthInches?: number | null;
};

function reject(detail: string): never {
  throw new MedusaError(
    MedusaError.Types.INVALID_DATA,
    `Invalid line item customization — ${detail}`,
  );
}

export function validateCustomization(
  input: unknown,
  { bounds, minDpi, orderedWidthInches }: CustomizationRules,
): LineItemCustomization {
  const result = lineItemCustomizationSchema.safeParse(input);

  if (!result.success) {
    reject(
      result.error.issues
        .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
        .join("; "),
    );
  }

  const { dimensions, artwork } = result.data;

  if (dimensions) {
    const detail = Object.entries(checkCustomDimensions(dimensions, bounds))
      .map(([field, message]) => `${field}: ${message}`)
      .join("; ");

    if (detail !== "") reject(detail);
  }

  if (artwork) {
    // A preset size carries its width on the option value rather than the
    // payload, so the caller may name it; the typed dimensions are the fallback.
    const widthInches = orderedWidthInches ?? dimensions?.widthInches ?? null;
    const resolution = checkArtworkResolution(artwork, {
      minDpi,
      orderedWidthInches: widthInches,
    });

    if (!resolution.ok) reject(`artwork: ${resolution.message}`);
  }

  return result.data;
}
