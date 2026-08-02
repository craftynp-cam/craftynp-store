import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CatalogView, Container, StoreUnavailable } from "@/components";
import { fetchCatalogSidebar } from "@/lib/categories";
import { MedusaUnavailableError } from "@/lib/medusa-error";
import { fetchCatalogProducts } from "@/lib/product-list";
import { fetchRegion } from "@/lib/region";
import { categoryHref } from "@/lib/routes";
import { parseSort } from "@/lib/sort";

type CategoryPageProps = {
  params: Promise<{ category: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function loadCategory(handle: string) {
  const sidebar = await fetchCatalogSidebar();
  const category = sidebar.categories.find((entry) => entry.handle === handle);
  return category ? { sidebar, category } : null;
}

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { category: handle } = await params;
  const loaded = await loadCategory(handle).catch(() => null);
  if (!loaded) return {};

  return { title: loaded.category.name };
}

export default async function CategoryPage({
  params,
  searchParams,
}: CategoryPageProps) {
  const { category: handle } = await params;
  const { sort: sortParam } = await searchParams;
  const sort = parseSort(sortParam);

  let loaded, products;
  try {
    loaded = await loadCategory(handle);
    if (!loaded) notFound();

    const region = await fetchRegion();
    products = await fetchCatalogProducts({
      categoryId: loaded.category.id,
      sort,
      regionId: region?.id,
    });
  } catch (error) {
    if (error instanceof MedusaUnavailableError) return <StoreUnavailable />;
    throw error;
  }

  const { sidebar, category } = loaded;
  const href = categoryHref(category.handle);

  return (
    <main id="main-content" tabIndex={-1} className="py-8">
      <Container>
        <CatalogView
          title={category.name}
          breadcrumbLabels={{ [href]: category.name }}
          basePath={href}
          activeHref={href}
          sidebarCategories={sidebar.categories}
          totalCount={sidebar.totalCount}
          sort={sort}
          products={products.map((product) => product.card)}
        />
      </Container>
    </main>
  );
}
