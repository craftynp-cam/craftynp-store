import { render, screen } from "@testing-library/react";

import { ProductListItem } from ".";

describe("ProductListItem", () => {
  it("renders the product title", () => {
    render(
      <ul>
        <ProductListItem title="Medusa Sweatshirt" />
      </ul>,
    );

    expect(screen.getByRole("listitem")).toHaveTextContent("Medusa Sweatshirt");
  });
});
