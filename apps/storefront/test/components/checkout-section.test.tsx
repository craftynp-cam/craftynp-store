import { render, screen } from "@testing-library/react";

import { CheckoutSection } from "@/components";

describe("CheckoutSection", () => {
  it("names its heading with the step number and title", () => {
    render(
      <CheckoutSection step={2} title="Delivery address">
        <p>content</p>
      </CheckoutSection>,
    );

    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading).toHaveTextContent("Step 2: Delivery address");
  });

  it("labels the section by its heading", () => {
    render(
      <CheckoutSection step={2} title="Delivery address">
        <p>content</p>
      </CheckoutSection>,
    );

    expect(
      screen.getByRole("region", { name: /Delivery address/ }),
    ).toBeInTheDocument();
  });

  it("does not let the visible badge duplicate the accessible name", () => {
    render(
      <CheckoutSection step={2} title="Delivery address">
        <p>content</p>
      </CheckoutSection>,
    );

    const region = screen.getByRole("region", { name: /Delivery address/ });
    expect(region).toHaveAccessibleName("Step 2: Delivery address");
  });

  it("renders its children", () => {
    render(
      <CheckoutSection step={1} title="Contact">
        <p>Field goes here</p>
      </CheckoutSection>,
    );

    expect(screen.getByText("Field goes here")).toBeInTheDocument();
  });

  it("changes only the step number when given a different step", () => {
    render(
      <CheckoutSection step={4} title="Payment">
        <p>content</p>
      </CheckoutSection>,
    );

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "Step 4: Payment",
    );
  });
});
