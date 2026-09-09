import { validateProductCustomization } from "@craftynp/types";
import { MedusaError } from "@medusajs/framework/utils";

export type ProductCustomizationInput = {
  id: string;
  title: string;
  status?: string | null;
  metadata?: Record<string, unknown> | null;
};

export function assertDeclaredCustomization(
  products: readonly ProductCustomizationInput[],
): void {
  const messages = products
    .map((product) => ({
      product,
      result: validateProductCustomization(product.metadata, {
        published: product.status === "published",
      }),
    }))
    .filter(
      (
        entry,
      ): entry is {
        product: ProductCustomizationInput;
        result: { ok: false; message: string };
      } => !entry.result.ok,
    )
    .map(
      ({ product, result }) =>
        `Cannot save "${product.title}": ${result.message}.`,
    );

  if (messages.length === 0) return;

  throw new MedusaError(MedusaError.Types.INVALID_DATA, messages.join(" "));
}
