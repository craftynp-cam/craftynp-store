import type { CatalogSort } from "@/lib/sort";

import { SortSelect } from "./sort-select";

type CatalogToolbarProps = { basePath: string; sort: CatalogSort };

export function CatalogToolbar({ basePath, sort }: CatalogToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-4 border-y border-border py-4">
      <div />
      <div className="flex items-center gap-3">
        <SortSelect basePath={basePath} sort={sort} />
      </div>
    </div>
  );
}
