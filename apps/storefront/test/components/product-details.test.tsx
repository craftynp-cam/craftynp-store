import { render, screen } from "@testing-library/react";

import { ProductDetails } from "@/components";

describe("ProductDetails", () => {
  it("renders the description under a Details heading", () => {
    render(<ProductDetails description="A ready-made favorite." />);

    expect(
      screen.getByRole("heading", { name: "Details" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/ready-made favorite/)).toBeInTheDocument();
  });

  it("renders no cross-sell link when the product has no custom equivalent", () => {
    render(<ProductDetails description="A ready-made favorite." />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders a cross-sell link to the custom product when one exists (AC 5)", () => {
    render(
      <ProductDetails
        description="A ready-made favorite."
        crossSellHref="/keychains/custom-keychain"
      />,
    );

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/keychains/custom-keychain");
  });
});
