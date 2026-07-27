import { fireEvent, render, screen } from "@testing-library/react";

import { Checkbox } from "@/components";

describe("Checkbox", () => {
  it("exposes its label as the accessible name", () => {
    render(<Checkbox>Gift wrap this order</Checkbox>);

    expect(
      screen.getByRole("checkbox", { name: "Gift wrap this order" }),
    ).toBeInTheDocument();
  });

  it("is unchecked by default", () => {
    render(<Checkbox>Gift wrap this order</Checkbox>);

    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });

  it("reflects a controlled checked state", () => {
    render(<Checkbox isSelected>Gift wrap this order</Checkbox>);

    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("reports selection changes", () => {
    const onChange = jest.fn();
    render(<Checkbox onChange={onChange}>Gift wrap this order</Checkbox>);

    fireEvent.click(screen.getByRole("checkbox"));

    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("disables the control natively, not only visually", () => {
    render(<Checkbox isDisabled>Gift wrap this order</Checkbox>);

    expect(screen.getByRole("checkbox")).toBeDisabled();
  });
});
