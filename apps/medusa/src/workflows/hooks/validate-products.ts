import {
  createProductsWorkflow,
  updateProductsWorkflow,
} from "@medusajs/medusa/core-flows";

import {
  assertDeclaredCustomization,
  type ProductCustomizationInput,
} from "../../lib/product-customization";
import {
  assertPublishableProducts,
  type ProductShippingDimensionsInput,
} from "../../lib/product-shipping-dimensions";

type ValidatedProduct = ProductShippingDimensionsInput &
  ProductCustomizationInput;

function assertProducts(products: readonly ValidatedProduct[]): void {
  assertPublishableProducts(products);
  assertDeclaredCustomization(products);
}

createProductsWorkflow.hooks.productsCreated(async ({ products }) => {
  assertProducts(products);
});

updateProductsWorkflow.hooks.productsUpdated(async ({ products }) => {
  assertProducts(products);
});
