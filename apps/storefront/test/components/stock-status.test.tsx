import { render, screen } from "@testing-library/react";

import { StockStatus } from "@/components";

describe("StockStatus", () => {
  it("names in-stock in text, not by colour alone", () => {
    render(<StockStatus availability="in_stock" />);

    expect(screen.getByText(/in stock/i)).toBeInTheDocument();
  });

  it("names low stock", () => {
    render(<StockStatus availability="low_stock" />);

    expect(screen.getByText(/low stock/i)).toBeInTheDocument();
  });

  it("names out of stock", () => {
    render(<StockStatus availability="out_of_stock" />);

    expect(screen.getByText(/out of stock/i)).toBeInTheDocument();
  });
});
