import Link from "next/link";

import type { SidebarCategory } from "@/lib/categories";

type CatalogSidebarProps = {
  categories: readonly SidebarCategory[];
  totalCount: number;
  activeHref: string;
};

const linkClassName =
  "flex shrink-0 items-center justify-between gap-3 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const activeClassName = "bg-primary text-on-primary";
const inactiveClassName =
  "text-foreground hover:bg-surface-soft aria-[current=page]:bg-primary aria-[current=page]:text-on-primary";

function CatalogSidebarLink({
  href,
  isActive,
  name,
  count,
}: {
  href: string;
  isActive: boolean;
  name: string;
  count: number;
}) {
  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={`${linkClassName} ${isActive ? activeClassName : inactiveClassName}`}
    >
      <span>{name}</span>
      <span
        className={isActive ? "text-on-primary/80" : "text-foreground-muted"}
      >
        {count}
      </span>
    </Link>
  );
}

export function CatalogSidebar({
  categories,
  totalCount,
  activeHref,
}: CatalogSidebarProps) {
  return (
    <nav aria-label="Categories" className="lg:w-64 lg:shrink-0">
      <h2 className="mb-3 font-display text-xl text-foreground">Categories</h2>
      <div className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0">
        <CatalogSidebarLink
          href="/products"
          isActive={activeHref === "/products"}
          name="All products"
          count={totalCount}
        />
        {categories.map((category) => (
          <CatalogSidebarLink
            key={category.href}
            href={category.href}
            isActive={activeHref === category.href}
            name={category.name}
            count={category.productCount}
          />
        ))}
      </div>
    </nav>
  );
}
