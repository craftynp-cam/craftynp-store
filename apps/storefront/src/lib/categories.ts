import { cache } from "react";

import { sdk } from "./medusa";
import { categoryHref } from "./routes";

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
      href: categoryHref(source.handle),
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

export type ShowcaseCategorySource = NavCategorySource & { id: string };

export type ShowcaseCategory = {
  name: string;
  href: string;
  productCount: number;
};

export function toShowcaseSources(
  sources: readonly ShowcaseCategorySource[],
): Array<{ id: string; name: string; href: string }> {
  return toNavCategories(sources).map((category) => {
    const source = sources.find(
      (candidate) => categoryHref(candidate.handle) === category.href,
    );
    // toNavCategories only returns entries built from a matching source, so
    // this is always found; the fallback keeps the function total.
    return { id: source?.id ?? "", ...category };
  });
}

export const fetchShowcaseCategories = cache(
  async (): Promise<ShowcaseCategory[]> => {
    try {
      const { product_categories } = await sdk.store.category.list({
        fields: "id,name,handle,parent_category_id",
        limit: 100,
      });
      const categories = toShowcaseSources(product_categories);

      const counts = await Promise.all(
        categories.map(async (category) => {
          try {
            const { count } = await sdk.store.product.list({
              category_id: [category.id],
              limit: 1,
              fields: "id",
            });
            return count;
          } catch (error) {
            console.error(
              `Could not load product count for category "${category.name}"`,
              error,
            );
            return 0;
          }
        }),
      );

      return categories.map((category, index) => ({
        name: category.name,
        href: category.href,
        productCount: counts[index] ?? 0,
      }));
    } catch (error) {
      console.error("Could not load showcase categories", error);
      return [];
    }
  },
);
