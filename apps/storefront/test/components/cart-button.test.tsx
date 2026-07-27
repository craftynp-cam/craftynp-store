import { act, render, screen } from "@testing-library/react";

import { CartButton } from "@/components";
import { setCartCount } from "@/lib/cart-count";

describe("CartButton", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("shows no badge and announces 'empty' when the cart is empty", () => {
    render(<CartButton />);

    const button = screen.getByRole("button", { name: "Cart, empty" });
    expect(button).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("shows the badge and the count in the accessible name once the count changes", () => {
    render(<CartButton />);

    act(() => setCartCount(3));

    expect(
      screen.getByRole("button", { name: "Cart, 3 items" }),
    ).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("removes the badge entirely when the count returns to zero", () => {
    setCartCount(2);
    render(<CartButton />);
    expect(screen.getByText("2")).toBeInTheDocument();

    act(() => setCartCount(0));

    expect(
      screen.getByRole("button", { name: "Cart, empty" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("2")).not.toBeInTheDocument();
  });

  it("hides the glyph from assistive technology", () => {
    const { container } = render(<CartButton />);

    const icon = container.querySelector("svg");
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });
});
