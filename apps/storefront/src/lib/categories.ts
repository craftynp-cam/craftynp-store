import { cache } from "react";

import { sdk } from "./medusa";
import { categoryHref } from "./routes";

export type NavCategorySource = {
  name: string;
  handle: string;
  parent_category_id?: string | null;
  metadata?: Record<string, unknown> | null;
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
  imageUrl: string;
  imageAlt: string;
};

export type CategoryImage = { imageUrl: string; imageAlt: string };

export function toCategoryImage(
  metadata: Record<string, unknown> | null | undefined,
): CategoryImage {
  const rawUrl = metadata?.["image_url"];
  const imageUrl = typeof rawUrl === "string" ? rawUrl.trim() : "";
  if (!imageUrl) return { imageUrl: "", imageAlt: "" };

  const rawAlt = metadata?.["image_alt"];
  return {
    imageUrl,
    imageAlt: typeof rawAlt === "string" ? rawAlt.trim() : "",
  };
}

export function toShowcaseSources(
  sources: readonly ShowcaseCategorySource[],
): Array<{ id: string; name: string; href: string } & CategoryImage> {
  return toNavCategories(sources).map((category) => {
    const source = sources.find(
      (candidate) => categoryHref(candidate.handle) === category.href,
    );
    return {
      id: source?.id ?? "",
      ...category,
      ...toCategoryImage(source?.metadata),
    };
  });
}

export type SidebarCategory = {
  id: string;
  name: string;
  handle: string;
  href: string;
  productCount: number;
};

export type SidebarCatalog = {
  totalCount: number;
  categories: SidebarCategory[];
};

export type ProductCategorySource = {
  categories?: readonly { id: string }[] | null;
};

export function toSidebarCategories(
  categorySources: readonly ShowcaseCategorySource[],
  productSources: readonly ProductCategorySource[],
): SidebarCatalog {
  const categories = toShowcaseSources(categorySources);

  const counts = new Map<string, number>();
  for (const product of productSources) {
    for (const category of product.categories ?? []) {
      counts.set(category.id, (counts.get(category.id) ?? 0) + 1);
    }
  }

  return {
    totalCount: productSources.length,
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      href: category.href,
      handle: category.href.slice(1),
      productCount: counts.get(category.id) ?? 0,
    })),
  };
}

export const fetchCatalogSidebar = cache(async (): Promise<SidebarCatalog> => {
  try {
    const [{ product_categories }, { products, count }] = await Promise.all([
      sdk.store.category.list({
        fields: "id,name,handle,parent_category_id",
        limit: 100,
      }),
      sdk.store.product.list({
        fields: "id,categories.id",
        limit: 100,
      }),
    ]);

    const sidebar = toSidebarCategories(product_categories, products);
    return { ...sidebar, totalCount: count };
  } catch (error) {
    console.error("Could not load the catalog sidebar", error);
    return { totalCount: 0, categories: [] };
  }
});

export const fetchShowcaseCategories = cache(
  async (): Promise<ShowcaseCategory[]> => {
    try {
      const { product_categories } = await sdk.store.category.list({
        fields: "id,name,handle,parent_category_id,metadata",
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
        imageUrl: category.imageUrl,
        imageAlt: category.imageAlt,
      }));
    } catch (error) {
      console.error("Could not load showcase categories", error);
      return [];
    }
  },
);
