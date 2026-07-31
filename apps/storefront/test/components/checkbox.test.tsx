import { render, screen } from "@testing-library/react";

import { Checkbox } from "@/components";

describe("Checkbox", () => {
  it("exposes its label as the accessible name", () => {
    render(<Checkbox>Gift wrap this order</Checkbox>);

    expect(
      screen.getByRole("checkbox", { name: "Gift wrap this order" }),
    ).toBeInTheDocument();
  });
});
