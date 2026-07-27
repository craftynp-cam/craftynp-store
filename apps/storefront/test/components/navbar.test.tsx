import { fireEvent, render, screen, within } from "@testing-library/react";

import { Navbar } from "@/components";
import type { NavCategory } from "@/lib/categories";

const categories: NavCategory[] = [
  { name: "Keychains", href: "/categories/keychains" },
  { name: "Stickers", href: "/categories/stickers" },
];

describe("Navbar", () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  it("renders the skip link before every other focusable control", () => {
    // The drawer's overlay only mounts once opened, and React Aria portals it
    // to document.body when it does — so while closed, `container` (scoped
    // to where Navbar rendered) reflects only the always-present header
    // controls, same as before the drawer existed.
    const { container } = render(<Navbar categories={categories} />);

    const focusable = container.querySelectorAll("a,button,input");
    expect(focusable[0]).toHaveAccessibleName("Skip to content");
  });

  it("exposes the menu button with an accessible name and no assistive-tech noise from the glyph", () => {
    render(<Navbar categories={categories} />);

    const menuButton = screen.getByRole("button", { name: "Open menu" });
    expect(menuButton).toHaveAttribute("aria-expanded", "false");
  });

  it("links the logo home", () => {
    render(<Navbar categories={categories} />);

    const homeLink = screen.getByRole("link", { name: /The Crafty NP/ });
    expect(homeLink).toHaveAttribute("href", "/");
  });

  it("exposes a labelled search field in the header", () => {
    render(<Navbar categories={categories} />);

    expect(
      within(screen.getByRole("banner")).getByRole("searchbox", {
        name: "Search products",
      }),
    ).toBeInTheDocument();
  });

  it("exposes the theme toggle, account link, and cart button", () => {
    render(<Navbar categories={categories} />);

    expect(screen.getByRole("button", { name: /Theme:/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Account" })).toHaveAttribute(
      "href",
      "/account",
    );
    expect(
      screen.getByRole("button", { name: "Cart, empty" }),
    ).toBeInTheDocument();
  });

  it("hides every icon glyph from assistive technology", () => {
    const { container } = render(<Navbar categories={categories} />);

    const icons = container.querySelectorAll("svg");
    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) {
      expect(icon).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("keeps the header search and the drawer's mobile search as two distinct fields", () => {
    // Scoped by querySelector rather than role: once the drawer is open,
    // React Aria marks everything outside it aria-hidden, so the header's
    // search field is deliberately unreachable by role — that's the
    // background-content containment AC 3 and AC 4 ask for, not a bug. This
    // just proves there are two real fields, not one moved via a DOM hack.
    // Queried from `document`, not the render container: React Aria portals
    // the dialog to `document.body` as a sibling of the container, not a
    // descendant of it.
    render(<Navbar categories={categories} />);

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));

    const dialog = screen.getByRole("dialog");
    const drawerSearch = within(dialog).getByRole("searchbox", {
      name: "Search products",
    });
    const fields = document.querySelectorAll('input[name="q"]');
    expect(fields).toHaveLength(2);
    expect([...fields]).toContain(drawerSearch);
  });
});
