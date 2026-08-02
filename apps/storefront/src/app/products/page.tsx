import type { Metadata } from "next";

import { CatalogView, Container, StoreUnavailable } from "@/components";
import { fetchCatalogSidebar } from "@/lib/categories";
import { MedusaUnavailableError } from "@/lib/medusa-error";
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

  let sidebar, products;
  try {
    const [region, loadedSidebar] = await Promise.all([
      fetchRegion(),
      fetchCatalogSidebar(),
    ]);
    sidebar = loadedSidebar;
    products = await fetchCatalogProducts({ sort, regionId: region?.id });
  } catch (error) {
    if (error instanceof MedusaUnavailableError) return <StoreUnavailable />;
    throw error;
  }

  return (
    <main id="main-content" tabIndex={-1} className="py-8">
      <Container>
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
      </Container>
    </main>
  );
}
