export type Breadcrumb = { label: string; href?: string };

function titleCase(segment: string): string {
  return segment
    .split(/[-_]+/)
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

export function toBreadcrumbs(pathname: string): Breadcrumb[] {
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return [{ label: "Home" }];

  const home: Breadcrumb = { label: "Home", href: "/" };

  let path = "";
  const crumbs = segments.map((segment, index) => {
    path += `/${segment}`;
    const isLast = index === segments.length - 1;
    return { label: titleCase(segment), href: isLast ? undefined : path };
  });

  return [home, ...crumbs];
}
