import { cache } from "react";

import { sdk } from "./medusa";

/**
 * A narrow structural type rather than the SDK's generated category type, so
 * this stays testable without a live backend and only names the fields it
 * actually reads.
 */
export type NavCategorySource = {
  name: string;
  handle: string;
  parent_category_id?: string | null;
};

export type NavCategory = { name: string; href: string };

/**
 * Top-level categories only, alphabetised. Filtering by `parent_category_id`
 * happens here rather than in the query: the SDK's `qs.stringify` runs with
 * `skipNulls`, so `parent_category_id: null` is silently dropped from the URL
 * and the store API would return every descendant too.
 */
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

/**
 * The navbar renders on every page, so a Medusa outage must degrade to the
 * drawer's empty state rather than take the whole site down — errors are
 * caught and logged, never thrown.
 *
 * Caching is React's request-scoped `cache()` only. The SDK's `category.list`
 * forwards no `init`, so `next: { revalidate }` can't reach the underlying
 * fetch, and neither `unstable_cache` nor `"use cache"` have an invalidation
 * story yet — that's a later story's decision, not this one's.
 *
 * `limit: 100` is a deliberate ceiling for a nav menu; the store default is
 * 50, and AC 2 asks for "however many exist".
 */
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
