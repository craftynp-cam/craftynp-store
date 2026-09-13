import { render, screen } from "@testing-library/react";

import { RadioButtonGroup } from "@/components";

const options = [
  { value: "val_blush", label: "Blush" },
  { value: "val_sage", label: "Sage", subLabel: "Matte finish" },
  {
    value: "val_navy",
    label: "Navy",
    isDisabled: true,
    disabledReason: "unavailable with your current choices",
  },
];

describe("RadioButtonGroup", () => {
  it("names a value by its label alone when it has nothing else to add", () => {
    render(
      <RadioButtonGroup label="Colour" options={options} value="val_blush" />,
    );

    expect(screen.getByRole("radio", { name: "Blush" })).toBeChecked();
  });

  it("folds a sub-label into the accessible name (AC 3)", () => {
    render(
      <RadioButtonGroup label="Colour" options={options} value="val_blush" />,
    );

    expect(
      screen.getByRole("radio", { name: "Sage, Matte finish" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Matte finish")).toBeInTheDocument();
  });

  it("folds the reason into the accessible name of a disabled value (AC 4)", () => {
    render(
      <RadioButtonGroup label="Colour" options={options} value="val_blush" />,
    );

    const navy = screen.getByRole("radio", {
      name: "Navy, unavailable with your current choices",
    });
    expect(navy).toBeDisabled();
  });

  it("leaves the reason off a value that is not disabled", () => {
    render(
      <RadioButtonGroup
        label="Colour"
        value="val_blush"
        options={[
          {
            value: "val_navy",
            label: "Navy",
            disabledReason: "unavailable with your current choices",
          },
        ]}
      />,
    );

    expect(screen.getByRole("radio", { name: "Navy" })).toBeEnabled();
  });

  it("stays required without reading as invalid before it is answered (CNP-83 AC 2)", () => {
    render(
      <RadioButtonGroup
        label="Colour"
        options={options}
        value={null}
        isRequired
      />,
    );

    const group = screen.getByRole("radiogroup");
    expect(group).toHaveAttribute("aria-required", "true");
    expect(group).not.toHaveAttribute("aria-invalid");
    for (const radio of screen.getAllByRole<HTMLInputElement>("radio")) {
      expect(radio.required).toBe(false);
    }
  });
});
