import { fireEvent, render, screen } from "@testing-library/react";

import { SortSelect } from "@/components";

const push = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

describe("SortSelect", () => {
  afterEach(() => {
    push.mockClear();
  });

  it("navigates to the selected sort's href", () => {
    render(<SortSelect basePath="/products" sort="featured" />);

    fireEvent.click(screen.getByRole("button", { name: /sort/i }));
    fireEvent.click(screen.getByRole("option", { name: "Price: low to high" }));

    expect(push).toHaveBeenCalledWith("/products?sort=price-asc");
  });

  it("navigates to the clean base path when featured is selected", () => {
    render(<SortSelect basePath="/products" sort="price-asc" />);

    fireEvent.click(screen.getByRole("button", { name: /sort/i }));
    fireEvent.click(screen.getByRole("option", { name: "Featured" }));

    expect(push).toHaveBeenCalledWith("/products");
  });

  it("carries the category base path", () => {
    render(<SortSelect basePath="/shirts" sort="featured" />);

    fireEvent.click(screen.getByRole("button", { name: /sort/i }));
    fireEvent.click(screen.getByRole("option", { name: "Newest" }));

    expect(push).toHaveBeenCalledWith("/shirts?sort=newest");
  });
});
