import { render, screen } from "@testing-library/react";

import { ProductPrice } from "@/components";

describe("ProductPrice", () => {
  it("renders a single price when not on sale", () => {
    render(<ProductPrice price="$9.00" />);

    expect(screen.getByText("$9.00")).toBeInTheDocument();
    expect(screen.queryByText("Now")).not.toBeInTheDocument();
  });

  it("announces the sale with a text alternative, not colour alone (AC 2)", () => {
    render(<ProductPrice price="$9.00" originalPrice="$12.00" />);

    expect(screen.getByText("Now")).toBeInTheDocument();
    expect(screen.getByText("Was")).toBeInTheDocument();
    expect(screen.getByText("$9.00")).toBeInTheDocument();
    expect(screen.getByText("$12.00")).toBeInTheDocument();
  });

  it("shows a savings badge when one is given", () => {
    render(
      <ProductPrice
        price="$9.00"
        originalPrice="$12.00"
        savingsLabel="Save 25%"
      />,
    );

    expect(screen.getByText("Save 25%")).toBeInTheDocument();
  });
});
