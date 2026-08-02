import { render, screen } from "@testing-library/react";

import { ProductGrid } from "@/components";
import type { ProductCardData } from "@/components";

const products: ProductCardData[] = [
  {
    href: "/stickers/die-cut",
    title: "Custom Die-Cut Stickers",
    category: "Stickers",
    price: "$0.55",
  },
  {
    href: "/shirts/printed-tee",
    title: "Custom Printed Tee",
    category: "Shirts",
    price: "$18.00",
  },
];

describe("ProductGrid", () => {
  it("renders one card per product", () => {
    render(<ProductGrid products={products} />);

    expect(
      screen.getByRole("heading", { name: "Custom Die-Cut Stickers" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Custom Printed Tee" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  it("shows an empty state with a link back to all products when there are none", () => {
    render(<ProductGrid products={[]} />);

    expect(screen.queryAllByRole("heading")).toHaveLength(0);
    const link = screen.getByRole("link", { name: /browse all products/i });
    expect(link).toHaveAttribute("href", "/products");
  });
});
