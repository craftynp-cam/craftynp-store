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

  it("does not clamp a part-typed value up to the minimum", () => {
    const onChange = jest.fn();
    render(
      <QuantityStepper
        value={50}
        onChange={onChange}
        min={50}
        label="Quantity"
      />,
    );

    const input = screen.getByRole("spinbutton", { name: "Quantity" });
    for (const typed of ["1", "10", "100"]) {
      fireEvent.change(input, { target: { value: typed } });
    }

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(100);
  });

  it("raises a below-minimum value only once the shopper leaves the field", () => {
    const onChange = jest.fn();
    render(
      <QuantityStepper
        value={50}
        onChange={onChange}
        min={50}
        label="Quantity"
      />,
    );

    const input = screen.getByRole("spinbutton", { name: "Quantity" });
    fireEvent.change(input, { target: { value: "2" } });
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(50);
  });

  it("commits a typed value on Enter, so a keyboard needs no blur", () => {
    const onChange = jest.fn();
    render(
      <QuantityStepper
        value={50}
        onChange={onChange}
        min={50}
        label="Quantity"
      />,
    );

    const input = screen.getByRole("spinbutton", { name: "Quantity" });
    fireEvent.change(input, { target: { value: "3" } });
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(50);
  });

  it("rejects a keystroke that is not a digit", () => {
    const onChange = jest.fn();
    render(<QuantityStepper value={4} onChange={onChange} label="Quantity" />);

    fireEvent.change(screen.getByRole("spinbutton", { name: "Quantity" }), {
      target: { value: "-1" },
    });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("speaks the committed quantity", () => {
    render(<QuantityStepper value={3} onChange={jest.fn()} label="Quantity" />);

    expect(screen.getByRole("status")).toHaveTextContent("Quantity 3.");
  });

  it("stays silent while the shopper is still typing", () => {
    render(<QuantityStepper value={3} onChange={jest.fn()} label="Quantity" />);

    fireEvent.change(screen.getByRole("spinbutton", { name: "Quantity" }), {
      target: { value: "7" },
    });

    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("says why decrement is disabled at the minimum", () => {
    render(
      <QuantityStepper
        value={50}
        onChange={jest.fn()}
        min={50}
        label="Quantity"
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "the fewest you can order",
    );
  });

  it("describes the minimum to the input, not by a disabled button alone", () => {
    render(
      <QuantityStepper
        value={50}
        onChange={jest.fn()}
        min={50}
        label="Quantity"
        description="Minimum order: 50"
      />,
    );

    expect(
      screen.getByRole("spinbutton", { name: "Quantity" }),
    ).toHaveAccessibleDescription("Minimum order: 50");
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
