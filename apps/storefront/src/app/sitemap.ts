import type { MetadataRoute } from "next";

import { fetchNavCategories } from "@/lib/categories";
import { fetchCatalogProducts } from "@/lib/product-list";
import { fetchRegion } from "@/lib/region";
import { toSitemapEntries } from "@/lib/sitemap";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, region] = await Promise.all([
    fetchNavCategories(),
    fetchRegion(),
  ]);
  const products = await fetchCatalogProducts({
    sort: "featured",
    regionId: region?.id,
  });

  return toSitemapEntries([
    ...categories.map((category) => category.href),
    ...products.map((product) => product.card.href),
  ]);
}
