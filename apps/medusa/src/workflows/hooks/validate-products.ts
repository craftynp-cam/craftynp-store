import type { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import {
  createProductsWorkflow,
  updateProductsWorkflow,
} from "@medusajs/medusa/core-flows";

import {
  PRODUCT_OPTION_FIELDS,
  assertCustomSizeOption,
  assertDeclaredCustomization,
  type ProductCustomizationInput,
  type ProductWithOptionsInput,
} from "../../lib/product-customization";
import {
  assertPublishableProducts,
  type ProductShippingDimensionsInput,
} from "../../lib/product-shipping-dimensions";

type ValidatedProduct = ProductShippingDimensionsInput &
  ProductCustomizationInput;

async function assertProducts(
  products: readonly ValidatedProduct[],
  container: MedusaContainer,
): Promise<void> {
  assertPublishableProducts(products);
  assertDeclaredCustomization(products);

  if (products.length === 0) return;

  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "title", "status", "metadata", ...PRODUCT_OPTION_FIELDS],
    filters: { id: products.map((product) => product.id) },
  });

  assertCustomSizeOption(data as ProductWithOptionsInput[]);
}

createProductsWorkflow.hooks.productsCreated(
  async ({ products }, { container }) => {
    await assertProducts(products, container);
  },
);

updateProductsWorkflow.hooks.productsUpdated(
  async ({ products }, { container }) => {
    await assertProducts(products, container);
  },
);
