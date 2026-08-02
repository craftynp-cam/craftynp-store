import type { SidebarCategory } from "@/lib/categories";
import type { CatalogSort } from "@/lib/sort";

import type { ProductCardData } from "../cards";
import { Breadcrumbs } from "../nav";
import { CatalogSidebar } from "./catalog-sidebar";
import { CatalogToolbar } from "./catalog-toolbar";
import { ProductGrid } from "./product-grid";

type CatalogViewProps = {
  title: string;
  breadcrumbLabels?: Record<string, string>;
  basePath: string;
  activeHref: string;
  sidebarCategories: readonly SidebarCategory[];
  totalCount: number;
  sort: CatalogSort;
  products: readonly ProductCardData[];
};

export function CatalogView({
  title,
  breadcrumbLabels,
  basePath,
  activeHref,
  sidebarCategories,
  totalCount,
  sort,
  products,
}: CatalogViewProps) {
  return (
    <>
      <Breadcrumbs labels={breadcrumbLabels} />

      <div className="mt-4 flex items-baseline justify-between gap-4">
        <h1 className="font-display text-4xl text-foreground sm:text-5xl">
          {title}
        </h1>
        <p className="shrink-0 text-foreground-muted">
          {products.length} {products.length === 1 ? "product" : "products"}
        </p>
      </div>

      <div className="mt-8 lg:flex lg:items-start lg:gap-10 xl:gap-14">
        <CatalogSidebar
          categories={sidebarCategories}
          totalCount={totalCount}
          activeHref={activeHref}
        />

        <div className="mt-6 min-w-0 flex-1 lg:mt-0">
          <CatalogToolbar basePath={basePath} sort={sort} />
          <div className="mt-6">
            <ProductGrid products={products} />
          </div>
        </div>
      </div>
    </>
  );
}
