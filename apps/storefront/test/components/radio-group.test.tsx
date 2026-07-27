import { fireEvent, render, screen } from "@testing-library/react";

import { RadioGroup } from "@/components";

const options = [
  { value: "standard", label: "Standard" },
  { value: "express", label: "Express" },
  { value: "collection", label: "Collect in person", isDisabled: true },
] as const;

describe("RadioGroup", () => {
  it("names the group with its label", () => {
    render(<RadioGroup label="Delivery" options={options} />);

    expect(
      screen.getByRole("radiogroup", { name: "Delivery" }),
    ).toBeInTheDocument();
  });

  it("renders one radio per option", () => {
    render(<RadioGroup label="Delivery" options={options} />);

    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });

  it("reflects a controlled selection", () => {
    render(<RadioGroup label="Delivery" options={options} value="express" />);

    expect(screen.getByRole("radio", { name: "Express" })).toBeChecked();
  });

  it("reports selection changes", () => {
    const onChange = jest.fn();
    render(
      <RadioGroup label="Delivery" options={options} onChange={onChange} />,
    );

    fireEvent.click(screen.getByRole("radio", { name: "Express" }));

    expect(onChange).toHaveBeenCalledWith("express");
  });

  it("disables individual options", () => {
    render(<RadioGroup label="Delivery" options={options} />);

    expect(
      screen.getByRole("radio", { name: "Collect in person" }),
    ).toBeDisabled();
  });

  it("describes the group once, rather than each option", () => {
    render(
      <RadioGroup
        label="Delivery"
        options={options}
        description="Posted within two working days."
      />,
    );

    const ids =
      screen
        .getByRole("radiogroup")
        .getAttribute("aria-describedby")
        ?.split(/\s+/) ?? [];
    const described = ids.map((id) => document.getElementById(id)?.textContent);

    expect(described).toContain("Posted within two working days.");
  });

  it("marks the group invalid and shows the error", () => {
    render(
      <RadioGroup
        label="Delivery"
        options={options}
        isInvalid
        errorMessage="Choose a delivery method."
      />,
    );

    expect(screen.getByRole("radiogroup")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByText("Choose a delivery method.")).toBeInTheDocument();
  });
});
