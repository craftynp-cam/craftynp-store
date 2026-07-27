import { render, screen } from "@testing-library/react";

import { Button } from ".";

describe("Button", () => {
  it("renders its label", () => {
    render(<Button>Add to basket</Button>);

    expect(
      screen.getByRole("button", { name: "Add to basket" }),
    ).toBeInTheDocument();
  });

  it.each(["primary", "secondary", "ghost"] as const)(
    "applies the %s variant",
    (variant) => {
      render(<Button variant={variant}>Go</Button>);

      expect(screen.getByRole("button")).toHaveClass(`button--${variant}`);
    },
  );

  it("marks itself busy while loading but stays focusable", () => {
    render(<Button isLoading>Save</Button>);

    const button = screen.getByRole("button");
    // aria-disabled, not disabled: a disabled element cannot hold focus, so
    // pressing a button that starts work would drop the reader's place.
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).not.toBeDisabled();
  });

  it("announces the loading state in text, not only colour", () => {
    render(<Button isLoading>Save</Button>);

    // The accessible name carries the state, so it survives a spinner that a
    // screen reader cannot see.
    expect(screen.getByRole("button")).toHaveAccessibleName(/Loading/);
  });

  it("uses a caller-supplied loading label", () => {
    render(
      <Button isLoading loadingLabel="Saving your basket">
        Save
      </Button>,
    );

    expect(screen.getByRole("button")).toHaveAccessibleName(
      /Saving your basket/,
    );
  });

  it("is not busy when merely disabled", () => {
    render(<Button isDisabled>Save</Button>);

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).not.toHaveAttribute("aria-busy");
  });
});
