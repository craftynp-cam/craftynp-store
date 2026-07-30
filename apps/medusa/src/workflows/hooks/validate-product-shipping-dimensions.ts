import {
  createProductsWorkflow,
  updateProductsWorkflow,
} from "@medusajs/medusa/core-flows";

import { assertPublishableProducts } from "../../lib/product-shipping-dimensions";

createProductsWorkflow.hooks.productsCreated(async ({ products }) => {
  assertPublishableProducts(products);
});

updateProductsWorkflow.hooks.productsUpdated(async ({ products }) => {
  assertPublishableProducts(products);
});
