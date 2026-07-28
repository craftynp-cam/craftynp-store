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
});
