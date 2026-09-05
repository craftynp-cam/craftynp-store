import { render, screen, within } from "@testing-library/react";

import { Footer, type FooterContact } from "@/components";
import type { NavCategory } from "@/lib/categories";
import { SOCIAL_LINKS } from "@/lib/site";

const categories: NavCategory[] = [
  { name: "Keychains", href: "/categories/keychains" },
  { name: "Stickers", href: "/categories/stickers" },
];

const contact: FooterContact = {
  phone: { label: "317.843.1640", href: "tel:+13178431640" },
  email: {
    label: "hello@thecraftynp.com",
    href: "mailto:hello@thecraftynp.com",
  },
};

describe("Footer", () => {
  it("derives the Shop column from the passed categories, not a hard-coded list", () => {
    const unusual: NavCategory[] = [
      { name: "Banners", href: "/categories/banners" },
      { name: "Cups", href: "/categories/cups" },
    ];
    render(<Footer categories={unusual} contact={contact} />);

    const shopNav = screen.getByRole("navigation", { name: "Shop links" });
    expect(
      within(shopNav).getByRole("link", { name: "All Products" }),
    ).toHaveAttribute("href", "/products");
    expect(
      within(shopNav).getByRole("link", { name: "Banners" }),
    ).toHaveAttribute("href", "/categories/banners");
    expect(within(shopNav).getByRole("link", { name: "Cups" })).toHaveAttribute(
      "href",
      "/categories/cups",
    );
    expect(within(shopNav).queryByText("Keychains")).not.toBeInTheDocument();
  });

  it("still renders the Shop column when there are no categories", () => {
    render(<Footer categories={[]} contact={contact} />);

    const shopNav = screen.getByRole("navigation", { name: "Shop links" });
    expect(
      within(shopNav).getByRole("link", { name: "All Products" }),
    ).toBeInTheDocument();
  });

  it("opens every social link in a new tab safely and names it for assistive tech", () => {
    render(<Footer categories={categories} contact={contact} />);

    for (const social of SOCIAL_LINKS) {
      const link = screen.getByRole("link", { name: social.label });
      expect(link).toHaveAttribute("href", social.href);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
  });

  it("hides every icon glyph from assistive technology", () => {
    const { container } = render(
      <Footer categories={categories} contact={contact} />,
    );

    const icons = container.querySelectorAll("svg");
    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) {
      expect(icon).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("links Get in touch to the contact details, custom quote, and about pages", () => {
    render(<Footer categories={categories} contact={contact} />);

    const contactNav = screen.getByRole("navigation", {
      name: "Get in touch links",
    });
    expect(
      within(contactNav).getByRole("link", { name: "317.843.1640" }),
    ).toHaveAttribute("href", "tel:+13178431640");
    expect(
      within(contactNav).getByRole("link", { name: "hello@thecraftynp.com" }),
    ).toHaveAttribute("href", "mailto:hello@thecraftynp.com");
    expect(
      within(contactNav).getByRole("link", {
        name: "Request a custom quote",
      }),
    ).toHaveAttribute("href", "/custom-quote");
    expect(
      within(contactNav).getByRole("link", { name: "About" }),
    ).toHaveAttribute("href", "/about");
  });

  it("falls back to the page links alone when neither contact detail is set", () => {
    render(
      <Footer categories={categories} contact={{ phone: null, email: null }} />,
    );

    const contactNav = screen.getByRole("navigation", {
      name: "Get in touch links",
    });
    expect(within(contactNav).getAllByRole("link")).toHaveLength(2);
    expect(within(contactNav).getAllByRole("listitem")).toHaveLength(2);
  });

  it("renders the current year in the copyright line", () => {
    render(<Footer categories={categories} contact={contact} />);

    expect(
      screen.getByText(
        new RegExp(`© ${new Date().getFullYear()} The Crafty NP`),
      ),
    ).toBeInTheDocument();
  });
});
