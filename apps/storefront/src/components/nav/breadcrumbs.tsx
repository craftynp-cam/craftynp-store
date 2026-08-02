"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { toBreadcrumbs } from "@/lib/breadcrumbs";

type BreadcrumbsProps = { labels?: Record<string, string> };

export function Breadcrumbs({ labels }: BreadcrumbsProps = {}) {
  const pathname = usePathname();
  const crumbs = toBreadcrumbs(pathname, labels);

  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-2 text-sm text-foreground-muted">
        {crumbs.map((crumb, index) => (
          <li
            key={`${crumb.label}-${index}`}
            className="flex items-center gap-2"
          >
            {index > 0 ? <span aria-hidden="true">/</span> : null}
            {crumb.href ? (
              <Link href={crumb.href} className="hover:text-foreground">
                {crumb.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-foreground">
                {crumb.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
