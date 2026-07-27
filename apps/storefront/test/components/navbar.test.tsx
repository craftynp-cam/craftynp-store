import { render, screen } from "@testing-library/react";

import { Navbar } from "@/components";

describe("Navbar", () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  it("renders the skip link before every other focusable control", () => {
    const { container } = render(<Navbar />);

    const focusable = container.querySelectorAll("a,button,input");
    expect(focusable[0]).toHaveAccessibleName("Skip to content");
  });

  it("exposes the menu button with an accessible name and no assistive-tech noise from the glyph", () => {
    render(<Navbar />);

    const menuButton = screen.getByRole("button", { name: "Open menu" });
    expect(menuButton).toHaveAttribute("aria-expanded", "false");
  });

  it("links the logo home", () => {
    render(<Navbar />);

    const homeLink = screen.getByRole("link", { name: /The Crafty NP/ });
    expect(homeLink).toHaveAttribute("href", "/");
  });

  it("exposes a labelled search field", () => {
    render(<Navbar />);

    expect(
      screen.getByRole("searchbox", { name: "Search products" }),
    ).toBeInTheDocument();
  });

  it("exposes the theme toggle, account link, and cart button", () => {
    render(<Navbar />);

    expect(screen.getByRole("button", { name: /Theme:/ })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Account" }),
    ).toHaveAttribute("href", "/account");
    expect(
      screen.getByRole("button", { name: "Cart, empty" }),
    ).toBeInTheDocument();
  });

  it("hides every icon glyph from assistive technology", () => {
    const { container } = render(<Navbar />);

    const icons = container.querySelectorAll("svg");
    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) {
      expect(icon).toHaveAttribute("aria-hidden", "true");
    }
  });
});
