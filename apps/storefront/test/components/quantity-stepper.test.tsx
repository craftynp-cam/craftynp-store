import { fireEvent, render, screen } from "@testing-library/react";

import { QuantityStepper } from "@/components";

describe("QuantityStepper", () => {
  it("labels the input for assistive tech, not the surrounding glyphs", () => {
    render(
      <QuantityStepper
        value={2}
        onChange={jest.fn()}
        label="Quantity for Stickers"
      />,
    );

    expect(
      screen.getByRole("spinbutton", { name: "Quantity for Stickers" }),
    ).toHaveValue(2);
    expect(
      screen.getByRole("button", { name: "Increase quantity" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Decrease quantity" }),
    ).toBeInTheDocument();
  });

  it("calls onChange with the incremented value", () => {
    const onChange = jest.fn();
    render(<QuantityStepper value={2} onChange={onChange} label="Quantity" />);

    fireEvent.click(screen.getByRole("button", { name: "Increase quantity" }));

    expect(onChange).toHaveBeenCalledWith(3);
  });

  it("calls onChange with the decremented value", () => {
    const onChange = jest.fn();
    render(<QuantityStepper value={2} onChange={onChange} label="Quantity" />);

    fireEvent.click(screen.getByRole("button", { name: "Decrease quantity" }));

    expect(onChange).toHaveBeenCalledWith(1);
  });

  it("disables decrement at the minimum instead of underflowing into removal", () => {
    const onChange = jest.fn();
    render(
      <QuantityStepper
        value={1}
        onChange={onChange}
        min={1}
        label="Quantity"
      />,
    );

    expect(
      screen.getByRole("button", { name: "Decrease quantity" }),
    ).toBeDisabled();
  });

  it("disables increment at the maximum", () => {
    const onChange = jest.fn();
    render(
      <QuantityStepper
        value={5}
        onChange={onChange}
        max={5}
        label="Quantity"
      />,
    );

    expect(
      screen.getByRole("button", { name: "Increase quantity" }),
    ).toBeDisabled();
  });

  it("rounds each end button to match the container, so the focus ring isn't clipped", () => {
    render(<QuantityStepper value={1} onChange={jest.fn()} label="Quantity" />);

    expect(
      screen.getByRole("button", { name: "Decrease quantity" }),
    ).toHaveClass("rounded-l-lg");
    expect(
      screen.getByRole("button", { name: "Increase quantity" }),
    ).toHaveClass("rounded-r-lg");
  });

  it("hides its glyphs from assistive technology", () => {
    const { container } = render(
      <QuantityStepper value={1} onChange={jest.fn()} label="Quantity" />,
    );

    const icons = container.querySelectorAll("svg");
    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) {
      expect(icon).toHaveAttribute("aria-hidden", "true");
    }
  });
});
