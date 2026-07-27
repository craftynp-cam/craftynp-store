import { render, screen } from "@testing-library/react";

import { Textarea } from "./textarea";

describe("Textarea", () => {
  it("associates the label with the control", () => {
    render(<Textarea label="Personalisation" />);

    expect(screen.getByLabelText("Personalisation")).toBeInTheDocument();
  });

  it("renders a textarea, not an input", () => {
    render(<Textarea label="Personalisation" />);

    expect(screen.getByLabelText("Personalisation").tagName).toBe("TEXTAREA");
  });

  it("applies the requested row count", () => {
    render(<Textarea label="Personalisation" rows={8} />);

    expect(screen.getByLabelText("Personalisation")).toHaveAttribute(
      "rows",
      "8",
    );
  });

  it("describes the control with its helper text", () => {
    render(
      <Textarea label="Personalisation" description="Up to 120 characters." />,
    );

    const ids =
      screen
        .getByLabelText("Personalisation")
        .getAttribute("aria-describedby")
        ?.split(/\s+/) ?? [];
    const described = ids.map((id) => document.getElementById(id)?.textContent);

    expect(described).toContain("Up to 120 characters.");
  });

  it("marks the control invalid", () => {
    render(
      <Textarea label="Personalisation" isInvalid errorMessage="Too long." />,
    );

    expect(screen.getByLabelText("Personalisation")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByText("Too long.")).toBeInTheDocument();
  });
});
