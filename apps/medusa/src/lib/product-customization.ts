import {
  validateCustomSizeOption,
  validateProductCustomization,
  type ProductCustomizationProblem,
  type ProductOwnOptionLike,
} from "@craftynp/types";
import { MedusaError } from "@medusajs/framework/utils";

export type ProductCustomizationInput = {
  id: string;
  title: string;
  status?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type ProductWithOptionsInput = ProductCustomizationInput & {
  product_options?: readonly (ProductOwnOptionLike | null)[] | null;
};

export const PRODUCT_OPTION_FIELDS = [
  "product_options.product_option.title",
  "product_options.values.value",
];

function assertEveryProduct<T extends ProductCustomizationInput>(
  products: readonly T[],
  validate: (product: T, published: boolean) => ProductCustomizationProblem,
): void {
  const messages = products.flatMap((product) => {
    const result = validate(product, product.status === "published");
    return result.ok
      ? []
      : [`Cannot save "${product.title}": ${result.message}.`];
  });

  if (messages.length === 0) return;

  throw new MedusaError(MedusaError.Types.INVALID_DATA, messages.join(" "));
}

export function assertDeclaredCustomization(
  products: readonly ProductCustomizationInput[],
): void {
  assertEveryProduct(products, (product, published) =>
    validateProductCustomization(product.metadata, { published }),
  );
}

export function assertCustomSizeOption(
  products: readonly ProductWithOptionsInput[],
): void {
  assertEveryProduct(products, (product, published) =>
    validateCustomSizeOption(product.metadata, product.product_options, {
      published,
    }),
  );
}
