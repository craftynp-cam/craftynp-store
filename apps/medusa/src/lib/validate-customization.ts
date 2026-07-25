import { MedusaError } from "@medusajs/framework/utils";
import {
  lineItemCustomizationSchema,
  type LineItemCustomization,
} from "@craftynp/types";

/**
 * Validates a line item customization payload received from the storefront.
 * The storefront validates too, but a client can send anything — the backend is
 * the boundary that matters.
 *
 * @throws MedusaError with type INVALID_DATA when the payload does not conform.
 */
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
