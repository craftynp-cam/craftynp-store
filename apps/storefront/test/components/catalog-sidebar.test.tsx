import { render, screen } from "@testing-library/react";

import { CatalogSidebar } from "@/components";
import type { SidebarCategory } from "@/lib/categories";

const categories: SidebarCategory[] = [
  {
    id: "pcat_1",
    name: "Shirts",
    handle: "shirts",
    href: "/shirts",
    productCount: 2,
  },
  {
    id: "pcat_2",
    name: "Stickers",
    handle: "stickers",
    href: "/stickers",
    productCount: 5,
  },
];

describe("CatalogSidebar", () => {
  it("renders an 'All products' link and one link per category, as links", () => {
    render(
      <CatalogSidebar
        categories={categories}
        totalCount={7}
        activeHref="/products"
      />,
    );

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(3);
    expect(screen.getByRole("link", { name: /all products/i })).toHaveAttribute(
      "href",
      "/products",
    );
    expect(screen.getByRole("link", { name: /shirts/i })).toHaveAttribute(
      "href",
      "/shirts",
    );
    expect(screen.getByRole("link", { name: /stickers/i })).toHaveAttribute(
      "href",
      "/stickers",
    );
  });

  it("renders each entry's product count", () => {
    render(
      <CatalogSidebar
        categories={categories}
        totalCount={7}
        activeHref="/products"
      />,
    );

    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("marks exactly the active entry with aria-current, not colour alone", () => {
    render(
      <CatalogSidebar
        categories={categories}
        totalCount={7}
        activeHref="/shirts"
      />,
    );

    expect(screen.getByRole("link", { name: /shirts/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: /all products/i }),
    ).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: /stickers/i })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("is labelled as a categories navigation region", () => {
    render(
      <CatalogSidebar categories={[]} totalCount={0} activeHref="/products" />,
    );

    expect(
      screen.getByRole("navigation", { name: "Categories" }),
    ).toBeInTheDocument();
  });
});
