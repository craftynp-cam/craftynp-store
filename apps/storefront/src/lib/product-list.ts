import { cache } from "react";

import type { ProductCardData } from "@/components";

import { sdk } from "./medusa";
import { isBackendFailure, MedusaUnavailableError } from "./medusa-error";
import { medusaOrder, type CatalogSort } from "./sort";
import {
  cheapestPrice,
  toProductCardProps,
  type ProductCardSourceProduct,
} from "./product-card";

export type CatalogProduct = { card: ProductCardData; amount: number };

export function sortCatalogProducts(
  products: readonly ProductCardSourceProduct[],
  sort: CatalogSort,
): CatalogProduct[] {
  const items = products.map((product) => ({
    card: toProductCardProps(product),
    amount: cheapestPrice(product)?.calculated_amount ?? 0,
  }));

  if (sort === "price-asc") {
    return [...items].sort((a, b) => a.amount - b.amount);
  }
  if (sort === "price-desc") {
    return [...items].sort((a, b) => b.amount - a.amount);
  }
  return items;
}

const CATALOG_LIMIT = 100;

export type FetchCatalogProductsParams = {
  categoryId?: string;
  sort: CatalogSort;
  regionId: string | undefined;
};

export const fetchCatalogProducts = cache(
  async ({
    categoryId,
    sort,
    regionId,
  }: FetchCatalogProductsParams): Promise<CatalogProduct[]> => {
    try {
      const { products } = await sdk.store.product.list({
        category_id: categoryId ? [categoryId] : undefined,
        region_id: regionId,
        order: medusaOrder(sort),
        limit: CATALOG_LIMIT,
        fields: "*variants.calculated_price,*categories",
      });

      return sortCatalogProducts(products, sort);
    } catch (error) {
      if (isBackendFailure(error)) {
        throw new MedusaUnavailableError("the catalogue", error);
      }
      console.error("Could not load catalog products", error);
      return [];
    }
  },
);
