import { cache } from "react";

import { sdk } from "./medusa";

export type NavCategorySource = {
  name: string;
  handle: string;
  parent_category_id?: string | null;
};

export type NavCategory = { name: string; href: string };

export function toNavCategories(
  sources: readonly NavCategorySource[],
): NavCategory[] {
  return sources
    .filter(
      (source) =>
        source.parent_category_id == null && source.name && source.handle,
    )
    .map((source) => ({
      name: source.name,
      href: `/categories/${source.handle}`,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export const fetchNavCategories = cache(async (): Promise<NavCategory[]> => {
  try {
    const { product_categories } = await sdk.store.category.list({
      fields: "id,name,handle,parent_category_id",
      limit: 100,
    });
    return toNavCategories(product_categories);
  } catch (error) {
    console.error("Could not load navigation categories", error);
    return [];
  }
});
