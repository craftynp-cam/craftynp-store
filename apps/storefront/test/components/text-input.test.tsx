import { render, screen } from "@testing-library/react";

import { TextInput } from "@/components";

/** The ids React Aria generates are opaque, so resolve them through the DOM. */
function describedTextFor(element: HTMLElement): string[] {
  const ids = element.getAttribute("aria-describedby")?.split(/\s+/) ?? [];

  return ids.map((id) => document.getElementById(id)?.textContent ?? "");
}

describe("TextInput", () => {
  it("associates the label with the control", () => {
    render(<TextInput label="Recipient name" />);

    expect(screen.getByLabelText("Recipient name")).toBeInTheDocument();
  });

  it("describes the control with its helper text", () => {
    render(
      <TextInput
        label="Recipient name"
        description="Appears on the gift tag."
      />,
    );

    expect(describedTextFor(screen.getByLabelText("Recipient name"))).toContain(
      "Appears on the gift tag.",
    );
  });

  it("describes the control with its error text when invalid", () => {
    render(
      <TextInput
        label="Recipient name"
        errorMessage="Enter a name."
        isInvalid
      />,
    );

    expect(describedTextFor(screen.getByLabelText("Recipient name"))).toContain(
      "Enter a name.",
    );
  });

  it("describes the control with helper and error text together", () => {
    render(
      <TextInput
        label="Recipient name"
        description="Appears on the gift tag."
        errorMessage="Enter a name."
        isInvalid
      />,
    );

    expect(describedTextFor(screen.getByLabelText("Recipient name"))).toEqual(
      expect.arrayContaining(["Appears on the gift tag.", "Enter a name."]),
    );
  });

  it("marks the control invalid so the state is not colour-only", () => {
    render(<TextInput label="Recipient name" isInvalid errorMessage="Bad" />);

    expect(screen.getByLabelText("Recipient name")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("is not invalid by default", () => {
    render(<TextInput label="Recipient name" />);

    expect(screen.getByLabelText("Recipient name")).not.toHaveAttribute(
      "aria-invalid",
    );
  });

  it("does not render error text while valid", () => {
    render(<TextInput label="Recipient name" errorMessage="Enter a name." />);

    expect(screen.queryByText("Enter a name.")).not.toBeInTheDocument();
  });

  it("disables the control", () => {
    render(<TextInput label="Recipient name" isDisabled />);

    expect(screen.getByLabelText("Recipient name")).toBeDisabled();
  });
});
