import { fireEvent, render, screen } from "@testing-library/react";

import { Select } from "@/components";

const options = [
  { id: "small", label: "Small" },
  { id: "medium", label: "Medium" },
  { id: "large", label: "Large", isDisabled: true },
] as const;

describe("Select", () => {
  it("names the control with its label", () => {
    render(<Select label="Size" options={options} />);

    expect(screen.getByRole("button", { name: /Size/ })).toBeInTheDocument();
  });

  it("shows the placeholder until something is chosen", () => {
    render(<Select label="Size" options={options} placeholder="Pick a size" />);

    expect(screen.getByText("Pick a size")).toBeInTheDocument();
  });

  it("shows the selected option's label", () => {
    const { container } = render(
      <Select label="Size" options={options} selectedKey="medium" />,
    );

    // Scoped to the trigger: React Aria also mirrors the label into a hidden
    // native <select>, so an unscoped text query matches twice.
    expect(container.querySelector(".select__value")).toHaveTextContent(
      "Medium",
    );
  });

  it("lists the options once opened", () => {
    render(<Select label="Size" options={options} />);

    fireEvent.click(screen.getByRole("button", { name: /Size/ }));

    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  it("reports the chosen option", () => {
    const onSelectionChange = jest.fn();
    render(
      <Select
        label="Size"
        options={options}
        onSelectionChange={onSelectionChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Size/ }));
    fireEvent.click(screen.getByRole("option", { name: "Small" }));

    expect(onSelectionChange).toHaveBeenCalledWith("small");
  });

  it("marks the control invalid and shows the error", () => {
    render(
      <Select
        label="Size"
        options={options}
        isInvalid
        errorMessage="Choose a size."
      />,
    );

    expect(screen.getByText("Choose a size.")).toBeInTheDocument();
  });

  it("describes the control with its helper text", () => {
    render(
      <Select label="Size" options={options} description="Measured flat." />,
    );

    expect(screen.getByText("Measured flat.")).toBeInTheDocument();
  });
});
