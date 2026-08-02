import { render, screen } from "@testing-library/react";

import { CatalogView } from "@/components";
import type { ProductCardData } from "@/components";
import type { SidebarCategory } from "@/lib/categories";

const mockUsePathname = jest.fn();
const push = jest.fn();

jest.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
  useRouter: () => ({ push }),
}));

const categories: SidebarCategory[] = [
  {
    id: "pcat_1",
    name: "Shirts",
    handle: "shirts",
    href: "/shirts",
    productCount: 2,
  },
];

const products: ProductCardData[] = [
  {
    href: "/shirts/tee",
    title: "Custom Printed Tee",
    category: "Shirts",
    price: "$18.00",
  },
];

describe("CatalogView", () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue("/products");
  });

  it("renders exactly one H1 naming the view", () => {
    render(
      <CatalogView
        title="All products"
        basePath="/products"
        activeHref="/products"
        sidebarCategories={categories}
        totalCount={3}
        sort="featured"
        products={products}
      />,
    );

    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent("All products");
  });

  it("shows the result count", () => {
    render(
      <CatalogView
        title="All products"
        basePath="/products"
        activeHref="/products"
        sidebarCategories={categories}
        totalCount={3}
        sort="featured"
        products={products}
      />,
    );

    expect(screen.getByText("1 product")).toBeInTheDocument();
  });

  it("pluralizes the result count", () => {
    render(
      <CatalogView
        title="All products"
        basePath="/products"
        activeHref="/products"
        sidebarCategories={categories}
        totalCount={3}
        sort="featured"
        products={[...products, { ...products[0]!, href: "/shirts/other-tee" }]}
      />,
    );

    expect(screen.getByText("2 products")).toBeInTheDocument();
  });

  it("renders the sidebar and sort control even for an empty result", () => {
    render(
      <CatalogView
        title="Banners"
        basePath="/banners"
        activeHref="/banners"
        sidebarCategories={categories}
        totalCount={3}
        sort="featured"
        products={[]}
      />,
    );

    expect(
      screen.getByRole("navigation", { name: "Categories" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sort/i })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /browse all products/i }),
    ).toBeInTheDocument();
  });
});
