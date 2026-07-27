import { fireEvent, render, screen, within } from "@testing-library/react";

import { NavDrawer } from "@/components";
import type { NavCategory } from "@/lib/categories";

const categories: NavCategory[] = [
  { name: "Keychains", href: "/categories/keychains" },
  { name: "Stickers", href: "/categories/stickers" },
];

function open() {
  fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
  return screen.getByRole("dialog");
}

describe("NavDrawer", () => {
  it("is the only navigation present until opened — no horizontal desktop nav", () => {
    render(<NavDrawer categories={categories} />);

    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open menu" }),
    ).toBeInTheDocument();
  });

  it("renders All Products first, then one link per category in order", () => {
    render(<NavDrawer categories={categories} />);
    const dialog = open();

    const links = within(dialog)
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href")?.startsWith("/"));

    expect(links.map((link) => link.textContent)).toEqual([
      "All Products",
      "Keychains",
      "Stickers",
    ]);
    expect(links[0]).toHaveAttribute("href", "/products");
    expect(links[1]).toHaveAttribute("href", "/categories/keychains");
    expect(links[2]).toHaveAttribute("href", "/categories/stickers");
  });

  it("renders however many categories exist", () => {
    const many: NavCategory[] = Array.from({ length: 7 }, (_, i) => ({
      name: `Category ${i}`,
      href: `/categories/category-${i}`,
    }));
    render(<NavDrawer categories={many} />);
    const dialog = open();

    for (const category of many) {
      expect(
        within(dialog).getByRole("link", { name: category.name }),
      ).toBeInTheDocument();
    }
  });

  it("still offers All Products and shows an empty state when there are no categories", () => {
    render(<NavDrawer categories={[]} />);
    const dialog = open();

    expect(
      within(dialog).getByRole("link", { name: "All Products" }),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/on their way/i)).toBeInTheDocument();
  });

  it("puts the category list in a labelled nav landmark", () => {
    render(<NavDrawer categories={categories} />);
    const dialog = open();

    expect(
      within(dialog).getByRole("navigation", { name: "Shop" }),
    ).toBeInTheDocument();
  });

  it("contains a labelled search field", () => {
    render(<NavDrawer categories={categories} />);
    const dialog = open();

    expect(
      within(dialog).getByRole("searchbox", { name: "Search products" }),
    ).toBeInTheDocument();
  });

  it("does not let the decorative arrow contribute to a row's accessible name", () => {
    render(<NavDrawer categories={categories} />);
    const dialog = open();

    expect(
      within(dialog).getByRole("link", { name: "Stickers" }),
    ).toBeInTheDocument();
  });

  it("closes when a category link is clicked", () => {
    render(<NavDrawer categories={categories} />);
    const dialog = open();

    fireEvent.click(within(dialog).getByRole("link", { name: "Stickers" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
