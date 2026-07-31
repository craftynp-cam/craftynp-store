import { fireEvent, render, screen } from "@testing-library/react";

import { RadioCardGroup } from "@/components";

const options = [
  {
    value: "usps_ground_advantage",
    label: "USPS Ground Advantage",
    description: "Arrives in 4 business days",
    trailing: "$7.42",
  },
  {
    value: "usps_priority_mail",
    label: "USPS Priority Mail",
    description: "Arrives in 2 business days",
    trailing: "$11.90",
  },
  {
    value: "usps_priority_express",
    label: "USPS Priority Mail Express",
    description: "Arrives in 1 business day",
    trailing: "$32.15",
    isDisabled: true,
  },
] as const;

describe("RadioCardGroup", () => {
  it("names the group with its label", () => {
    render(<RadioCardGroup label="Shipping method" options={options} />);

    expect(
      screen.getByRole("radiogroup", { name: "Shipping method" }),
    ).toBeInTheDocument();
  });

  it("renders one radio per option", () => {
    render(<RadioCardGroup label="Shipping method" options={options} />);
    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });

  it("includes the description and price in each option's accessible name", () => {
    render(<RadioCardGroup label="Shipping method" options={options} />);

    const radio = screen.getByRole("radio", {
      name: /USPS Ground Advantage/,
    });
    expect(radio).toHaveAccessibleName(
      "USPS Ground Advantage Arrives in 4 business days $7.42",
    );
  });

  it("reports selection changes", () => {
    const onChange = jest.fn();
    render(
      <RadioCardGroup
        label="Shipping method"
        options={options}
        onChange={onChange}
      />,
    );

    fireEvent.click(
      screen.getByRole("radio", {
        name: "USPS Priority Mail Arrives in 2 business days $11.90",
      }),
    );
    expect(onChange).toHaveBeenCalledWith("usps_priority_mail");
  });

  it("disables an individual option", () => {
    render(<RadioCardGroup label="Shipping method" options={options} />);

    expect(
      screen.getByRole("radio", {
        name: "USPS Priority Mail Express Arrives in 1 business day $32.15",
      }),
    ).toBeDisabled();
  });

  it("marks the group invalid and shows the error", () => {
    render(
      <RadioCardGroup
        label="Shipping method"
        options={options}
        isInvalid
        errorMessage="Choose a delivery option."
      />,
    );

    expect(screen.getByRole("radiogroup")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByText("Choose a delivery option.")).toBeInTheDocument();
  });
});
