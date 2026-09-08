import { fireEvent, render, screen } from "@testing-library/react";

import { VariantSelector } from "@/components";

const options = [
  {
    id: "opt_color",
    title: "Color",
    values: [
      { id: "val_blush", value: "Blush" },
      { id: "val_sage", value: "Sage", subLabel: "Matte finish" },
      { id: "val_navy", value: "Navy" },
    ],
  },
];

const allAvailable = {
  opt_color: { val_blush: true, val_sage: true, val_navy: true },
};

const twoOptions = [
  ...options,
  {
    id: "opt_size",
    title: "Size",
    values: [
      { id: "val_small", value: "Small" },
      { id: "val_large", value: "Large" },
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
        availability={allAvailable}
      />,
    );

    expect(
      screen.getByRole("radiogroup", { name: "Color" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Blush" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Navy" })).not.toBeChecked();
  });

  it("marks every option group required (AC 5)", () => {
    render(
      <VariantSelector
        options={twoOptions}
        selected={{}}
        onChange={jest.fn()}
        availability={{ ...allAvailable, opt_size: {} }}
      />,
    );

    for (const name of ["Color", "Size"]) {
      expect(screen.getByRole("radiogroup", { name })).toHaveAttribute(
        "aria-required",
        "true",
      );
    }
  });

  it("carries a value's sub-label into its accessible name (AC 3)", () => {
    render(
      <VariantSelector
        options={options}
        selected={{ opt_color: "val_blush" }}
        onChange={jest.fn()}
        availability={allAvailable}
      />,
    );

    expect(
      screen.getByRole("radio", { name: "Sage, Matte finish" }),
    ).toBeInTheDocument();
  });

  it("disables an unavailable value and calls it sold out, rather than hiding it (AC 4)", () => {
    render(
      <VariantSelector
        options={options}
        selected={{}}
        onChange={jest.fn()}
        availability={{
          opt_color: { val_blush: true, val_sage: false, val_navy: true },
        }}
      />,
    );

    expect(
      screen.getByRole("radio", { name: "Sage, Matte finish, sold out" }),
    ).toBeDisabled();
    expect(
      screen.getByText("Struck-through choices are sold out."),
    ).toBeInTheDocument();
  });

  it("blames another option once one narrows the choice (AC 4)", () => {
    render(
      <VariantSelector
        options={twoOptions}
        selected={{ opt_size: "val_large" }}
        onChange={jest.fn()}
        availability={{
          opt_color: { val_blush: true, val_sage: false, val_navy: true },
          opt_size: { val_small: true, val_large: true },
        }}
      />,
    );

    expect(
      screen.getByRole("radio", {
        name: "Sage, Matte finish, unavailable with your current selection",
      }),
    ).toBeDisabled();
    expect(
      screen.getByText(
        "Struck-through choices are unavailable with your current selection.",
      ),
    ).toBeInTheDocument();
  });

  it("leaves a group unchecked while its option is unchosen (AC 5)", () => {
    render(
      <VariantSelector
        options={options}
        selected={{}}
        onChange={jest.fn()}
        availability={allAvailable}
      />,
    );

    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).not.toBeChecked();
    }
  });

  it("calls onChange with the option id and the selected value id", () => {
    const onChange = jest.fn();
    render(
      <VariantSelector
        options={options}
        selected={{ opt_color: "val_blush" }}
        onChange={onChange}
        availability={allAvailable}
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: "Navy" }));

    expect(onChange).toHaveBeenCalledWith("opt_color", "val_navy");
  });
});
