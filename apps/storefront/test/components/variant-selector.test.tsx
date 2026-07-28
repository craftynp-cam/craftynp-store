import { fireEvent, render, screen } from "@testing-library/react";

import { VariantSelector } from "@/components";

const options = [
  {
    id: "opt_color",
    title: "Color",
    values: [
      { id: "val_blush", value: "Blush" },
      { id: "val_sage", value: "Sage" },
      { id: "val_navy", value: "Navy" },
    ],
  },
];

describe("VariantSelector", () => {
  it("renders a labelled radio group per option, with a radio per value", () => {
    render(
      <VariantSelector
        options={options}
        selected={{ opt_color: "val_blush" }}
        onChange={jest.fn()}
        availability={{
          opt_color: { val_blush: true, val_sage: true, val_navy: true },
        }}
      />,
    );

    expect(
      screen.getByRole("radiogroup", { name: "Color" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Blush" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Sage" })).not.toBeChecked();
  });

  it("disables a value flagged unavailable, rather than hiding it (AC 4)", () => {
    render(
      <VariantSelector
        options={options}
        selected={{ opt_color: "val_blush" }}
        onChange={jest.fn()}
        availability={{
          opt_color: { val_blush: true, val_sage: false, val_navy: true },
        }}
      />,
    );

    expect(screen.getByRole("radio", { name: "Sage" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Sage" })).toBeDisabled();
  });

  it("calls onChange with the option id and the selected value id", () => {
    const onChange = jest.fn();
    render(
      <VariantSelector
        options={options}
        selected={{ opt_color: "val_blush" }}
        onChange={onChange}
        availability={{
          opt_color: { val_blush: true, val_sage: true, val_navy: true },
        }}
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: "Sage" }));

    expect(onChange).toHaveBeenCalledWith("opt_color", "val_sage");
  });
});
