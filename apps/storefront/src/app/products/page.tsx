import type { Metadata } from "next";

import { CatalogView } from "@/components";
import { fetchCatalogSidebar } from "@/lib/categories";
import { fetchCatalogProducts } from "@/lib/product-list";
import { fetchRegion } from "@/lib/region";
import { parseSort } from "@/lib/sort";

type ProductsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  title: "All products",
};

export default async function ProductsPage({
  searchParams,
}: ProductsPageProps) {
  const { sort: sortParam } = await searchParams;
  const sort = parseSort(sortParam);

  const [region, sidebar] = await Promise.all([
    fetchRegion(),
    fetchCatalogSidebar(),
  ]);

  const products = await fetchCatalogProducts({
    sort,
    regionId: region?.id,
  });

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto max-w-6xl px-4 py-8"
    >
      <CatalogView
        title="All products"
        breadcrumbLabels={{ "/products": "All products" }}
        basePath="/products"
        activeHref="/products"
        sidebarCategories={sidebar.categories}
        totalCount={sidebar.totalCount}
        sort={sort}
        products={products.map((product) => product.card)}
      />
    </main>
  );
}
