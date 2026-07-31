import { render, screen } from "@testing-library/react";

import { ProductCard } from "@/components";

describe("ProductCard", () => {
  it("prefixes the price with 'from' only when isFromPrice is set", () => {
    render(
      <ProductCard
        href="/products/stickers"
        title="Custom Die-Cut Stickers"
        category="Stickers"
        price="$0.55"
        isFromPrice
      />,
    );

    expect(screen.getByText(/from/)).toBeInTheDocument();
  });

  it("does not prefix a single price with 'from'", () => {
    render(
      <ProductCard
        href="/products/tote"
        title="Tote Bag"
        category="Bags"
        price="$24.00"
      />,
    );

    expect(screen.queryByText(/from/)).not.toBeInTheDocument();
  });

  it("shows the customizable badge for customizable products", () => {
    render(
      <ProductCard
        href="/products/stickers"
        title="Custom Die-Cut Stickers"
        category="Stickers"
        price="$0.55"
        isCustomizable
      />,
    );

    expect(screen.getByText(/customizable/i)).toBeInTheDocument();
    expect(screen.queryByText(/ready to ship/i)).not.toBeInTheDocument();
  });

  it("shows the ready-to-ship badge for ready-made products", () => {
    render(
      <ProductCard
        href="/products/keychain"
        title="Wildflower Acrylic Keychain"
        category="Keychains"
        price="$9.00"
      />,
    );

    expect(screen.getByText(/ready to ship/i)).toBeInTheDocument();
    expect(screen.queryByText(/customizable/i)).not.toBeInTheDocument();
  });

  it("shows the sale badge and both prices, announcing the discount in text", () => {
    render(
      <ProductCard
        href="/products/keychain"
        title="Wildflower Acrylic Keychain"
        category="Keychains"
        price="$9.00"
        originalPrice="$12.00"
      />,
    );

    expect(screen.getByText(/sale/i)).toBeInTheDocument();
    expect(screen.getByText("$9.00")).toBeInTheDocument();
    expect(screen.getByText("$12.00")).toBeInTheDocument();
    // The discount is carried in text, not only by the strikethrough and colour.
    expect(screen.getByText("Now")).toBeInTheDocument();
    expect(screen.getByText("Was")).toBeInTheDocument();
  });

  it("has no sale badge or original price when not on sale", () => {
    render(
      <ProductCard
        href="/products/keychain"
        title="Wildflower Acrylic Keychain"
        category="Keychains"
        price="$9.00"
      />,
    );

    expect(screen.queryByText(/sale/i)).not.toBeInTheDocument();
  });

  it("is a single link whose accessible name is the product title", () => {
    render(
      <ProductCard
        href="/products/stickers"
        title="Custom Die-Cut Stickers"
        category="Stickers"
        price="$0.55"
      />,
    );

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAccessibleName("Custom Die-Cut Stickers");
    expect(links[0]).toHaveAttribute("href", "/products/stickers");
  });

  describe("loading state", () => {
    it("renders skeletons instead of a link or product content", () => {
      const { container } = render(<ProductCard isLoading />);

      expect(container.querySelectorAll(".skeleton").length).toBeGreaterThan(0);
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
    });

    it("is hidden from assistive technology, since it names no product yet", () => {
      const { container } = render(<ProductCard isLoading />);

      expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
    });
  });
});
