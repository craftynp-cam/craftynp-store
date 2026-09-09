import { fireEvent, render, screen } from "@testing-library/react";

import { VariantSelector } from "@/components";
import type { OptionValueStatus } from "@/lib/variant";

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

const allAvailable: Record<string, Record<string, OptionValueStatus>> = {
  opt_color: {
    val_blush: "available",
    val_sage: "available",
    val_navy: "available",
  },
};

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
        availability={allAvailable}
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

  it("calls a value with no purchasable variant anywhere sold out (AC 4)", () => {
    render(
      <VariantSelector
        options={twoOptions}
        selected={{ opt_size: "val_large" }}
        onChange={jest.fn()}
        availability={{
          opt_color: {
            val_blush: "available",
            val_sage: "sold_out",
            val_navy: "available",
          },
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

  it("blames the current selection only where another choice is the cause (AC 4)", () => {
    render(
      <VariantSelector
        options={twoOptions}
        selected={{ opt_size: "val_large" }}
        onChange={jest.fn()}
        availability={{
          opt_color: {
            val_blush: "available",
            val_sage: "incompatible",
            val_navy: "available",
          },
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

  it("names both causes when a group carries each (AC 4)", () => {
    render(
      <VariantSelector
        options={options}
        selected={{}}
        onChange={jest.fn()}
        availability={{
          opt_color: {
            val_blush: "available",
            val_sage: "sold_out",
            val_navy: "incompatible",
          },
        }}
      />,
    );

    expect(
      screen.getByText(
        "Struck-through choices are sold out or unavailable with your current selection.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: "Sage, Matte finish, sold out" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("radio", {
        name: "Navy, unavailable with your current selection",
      }),
    ).toBeDisabled();
  });

  it("still renders a group whose every value is unavailable", () => {
    render(
      <VariantSelector
        options={options}
        selected={{}}
        onChange={jest.fn()}
        availability={{
          opt_color: {
            val_blush: "sold_out",
            val_sage: "sold_out",
            val_navy: "sold_out",
          },
        }}
      />,
    );

    expect(
      screen.getByRole("radiogroup", { name: "Color" }),
    ).toBeInTheDocument();
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).toBeDisabled();
    }
  });

  it("draws no group for an option that offers no choice", () => {
    const { container } = render(
      <VariantSelector
        options={[
          {
            id: "opt_default",
            title: "Default option",
            values: [{ id: "val_default", value: "Default option value" }],
          },
        ]}
        selected={{ opt_default: "val_default" }}
        onChange={jest.fn()}
        availability={{ opt_default: { val_default: "available" } }}
      />,
    );

    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
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
