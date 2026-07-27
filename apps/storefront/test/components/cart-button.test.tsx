import { act, render, screen } from "@testing-library/react";

import { CartDrawer } from "@/components";
import { addCartLine, clearCart } from "@/lib/cart";

/**
 * CartButton only ever renders inside CartDrawer's Drawer/DrawerTrigger
 * pairing (see cart-drawer.tsx), so it's exercised through that harness here
 * rather than standalone — the same shape drawer.test.tsx uses for
 * DrawerTrigger generally.
 */
describe("CartButton", () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearCart();
  });

  it("shows no badge and announces 'empty' when the cart is empty", () => {
    render(<CartDrawer />);

    const button = screen.getByRole("button", { name: "Cart, empty" });
    expect(button).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("shows the badge and the count in the accessible name once a line is added", () => {
    render(<CartDrawer />);

    act(() =>
      addCartLine({
        id: "sticker",
        href: "/products/sticker",
        title: "Stickers",
        unitPrice: 0.75,
        currencyCode: "usd",
        quantity: 3,
      }),
    );

    expect(
      screen.getByRole("button", { name: "Cart, 3 items" }),
    ).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("removes the badge entirely when the cart empties again", () => {
    addCartLine({
      id: "sticker",
      href: "/products/sticker",
      title: "Stickers",
      unitPrice: 0.75,
      currencyCode: "usd",
      quantity: 2,
    });
    render(<CartDrawer />);
    expect(screen.getByText("2")).toBeInTheDocument();

    act(() => clearCart());

    expect(
      screen.getByRole("button", { name: "Cart, empty" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("2")).not.toBeInTheDocument();
  });

  it("hides the glyph from assistive technology", () => {
    const { container } = render(<CartDrawer />);

    const icon = container.querySelector("svg");
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });
});
