import {
  lineItemCustomizationSchema,
  type LineItemCustomization,
} from "@craftynp/types";
import { MedusaError } from "@medusajs/framework/utils";

export function validateCustomization(input: unknown): LineItemCustomization {
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

  return result.data;
}
