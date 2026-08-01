import { render, screen } from "@testing-library/react";

import { CategorySlide } from "@/components";

describe("CategorySlide", () => {
  it("renders the active slide's name as the page's h1", () => {
    render(
      <CategorySlide
        name="Shirts"
        href="/categories/shirts"
        productCount={2}
        imageUrl=""
        imageAlt=""
        isActive
        position={1}
        total={3}
      />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Shirts" }),
    ).toBeInTheDocument();
  });

  it("does not render a heading when inactive", () => {
    render(
      <CategorySlide
        name="Shirts"
        href="/categories/shirts"
        productCount={2}
        imageUrl=""
        imageAlt=""
        isActive={false}
        position={1}
        total={3}
      />,
    );

    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.getByText("Shirts")).toBeInTheDocument();
  });

  it("marks an inactive slide inert and hidden from assistive technology", () => {
    const { container } = render(
      <CategorySlide
        name="Shirts"
        href="/categories/shirts"
        productCount={2}
        imageUrl=""
        imageAlt=""
        isActive={false}
        position={1}
        total={3}
      />,
    );

    const slide = container.querySelector('[role="group"]');
    expect(slide).toHaveAttribute("aria-hidden", "true");
    expect(slide).toHaveAttribute("inert");
  });

  it("does not mark the active slide inert or hidden", () => {
    const { container } = render(
      <CategorySlide
        name="Shirts"
        href="/categories/shirts"
        productCount={2}
        imageUrl=""
        imageAlt=""
        isActive
        position={1}
        total={3}
      />,
    );

    const slide = container.querySelector('[role="group"]');
    expect(slide).not.toHaveAttribute("aria-hidden");
    expect(slide).not.toHaveAttribute("inert");
  });

  it("labels the slide with its position and name for assistive technology", () => {
    const { container } = render(
      <CategorySlide
        name="Shirts"
        href="/categories/shirts"
        productCount={2}
        imageUrl=""
        imageAlt=""
        isActive
        position={2}
        total={4}
      />,
    );

    expect(container.querySelector('[role="group"]')).toHaveAttribute(
      "aria-label",
      "2 of 4: Shirts",
    );
  });

  it("renders a Shop CTA pointing at the category", () => {
    render(
      <CategorySlide
        name="Shirts"
        href="/categories/shirts"
        productCount={2}
        imageUrl=""
        imageAlt=""
        isActive
        position={1}
        total={3}
      />,
    );

    expect(screen.getByRole("link", { name: /Shop Shirts/ })).toHaveAttribute(
      "href",
      "/categories/shirts",
    );
  });

  it("pluralises the product count", () => {
    render(
      <CategorySlide
        name="Shirts"
        href="/categories/shirts"
        productCount={1}
        imageUrl=""
        imageAlt=""
        isActive
        position={1}
        total={3}
      />,
    );

    expect(
      screen.getByRole("link", { name: /1 product\b/ }),
    ).toBeInTheDocument();
  });

  it("renders the category image with its alt text, and none without a url", () => {
    const { rerender } = render(
      <CategorySlide
        name="Shirts"
        href="/categories/shirts"
        productCount={2}
        imageUrl="https://cdn.example/shirts.jpg"
        imageAlt="A folded shirt"
        isActive
        position={1}
        total={3}
      />,
    );

    expect(screen.getByRole("img", { name: "A folded shirt" })).toBeVisible();

    rerender(
      <CategorySlide
        name="Shirts"
        href="/categories/shirts"
        productCount={2}
        imageUrl=""
        imageAlt="A folded shirt"
        isActive
        position={1}
        total={3}
      />,
    );

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("omits the count link when there are no products yet", () => {
    render(
      <CategorySlide
        name="Shirts"
        href="/categories/shirts"
        productCount={0}
        imageUrl=""
        imageAlt=""
        isActive
        position={1}
        total={3}
      />,
    );

    expect(screen.queryByText(/products?/)).not.toBeInTheDocument();
  });
});
