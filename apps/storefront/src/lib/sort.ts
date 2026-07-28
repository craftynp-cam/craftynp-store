export type CatalogSort = "featured" | "price-asc" | "price-desc" | "newest";

export const SORT_OPTIONS: readonly { id: CatalogSort; label: string }[] = [
  { id: "featured", label: "Featured" },
  { id: "price-asc", label: "Price: low to high" },
  { id: "price-desc", label: "Price: high to low" },
  { id: "newest", label: "Newest" },
];

const SORT_IDS = new Set(SORT_OPTIONS.map((option) => option.id));

export function parseSort(
  value: string | readonly string[] | undefined,
): CatalogSort {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate != null && SORT_IDS.has(candidate as CatalogSort)
    ? (candidate as CatalogSort)
    : "featured";
}

export function sortHref(basePath: string, sort: CatalogSort): string {
  return sort === "featured" ? basePath : `${basePath}?sort=${sort}`;
}

export function medusaOrder(sort: CatalogSort): string | undefined {
  return sort === "newest" ? "-created_at" : undefined;
}
