import {
  checkCustomDimensions,
  lineItemCustomizationSchema,
  type CustomSizeBounds,
  type LineItemCustomization,
} from "@craftynp/types";
import { MedusaError } from "@medusajs/framework/utils";

export function validateCustomization(
  input: unknown,
  bounds: CustomSizeBounds,
): LineItemCustomization {
  const result = lineItemCustomizationSchema.safeParse(input);

  if (!result.success) {
    const detail = result.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");

    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Invalid line item customization — ${detail}`,
    );
  }

  const { dimensions } = result.data;
  if (dimensions) {
    const errors = checkCustomDimensions(dimensions, bounds);
    const detail = Object.entries(errors)
      .map(([field, message]) => `${field}: ${message}`)
      .join("; ");

    if (detail !== "") {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Invalid line item customization — ${detail}`,
      );
    }
  }

  return result.data;
}
