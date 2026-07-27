import { act, fireEvent, render, screen, within } from "@testing-library/react";

import { CartDrawer } from "@/components";
import { addCartLine, clearCart } from "@/lib/cart";
import { setCartDrawerOpen } from "@/lib/cart-drawer";

function open() {
  fireEvent.click(screen.getByRole("button", { name: /Cart/ }));
  return screen.getByRole("dialog");
}

function addLine(overrides: Partial<Parameters<typeof addCartLine>[0]> = {}) {
  addCartLine({
    id: "sticker",
    href: "/products/sticker",
    title: "Custom Die-Cut Stickers",
    unitPrice: 0.75,
    currencyCode: "usd",
    quantity: 2,
    ...overrides,
  });
}

describe("CartDrawer", () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearCart();
    setCartDrawerOpen(false);
  });

  it("opens on trigger press and names the dialog from its title", () => {
    render(<CartDrawer />);

    const dialog = open();

    expect(
      within(dialog).getByRole("heading", { level: 2, name: /Your cart/ }),
    ).toBeInTheDocument();
  });

  it("opens programmatically via openCartDrawer — the seam CNP-45 uses on add-to-cart", async () => {
    const { openCartDrawer } = await import("@/lib/cart-drawer");
    render(<CartDrawer />);

    act(() => openCartDrawer());

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("closes on Escape and returns focus to the trigger", () => {
    render(<CartDrawer />);
    const trigger = screen.getByRole("button", { name: /Cart/ });
    act(() => trigger.focus());
    fireEvent.click(trigger);

    fireEvent.keyDown(screen.getByRole("dialog"), {
      key: "Escape",
      code: "Escape",
    });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("shows the empty state with a disabled checkout when the cart has no lines", () => {
    render(<CartDrawer />);
    const dialog = open();

    expect(within(dialog).getByText(/cart is empty/i)).toBeInTheDocument();
    expect(within(dialog).getByText("$0.00")).toBeInTheDocument();
    expect(
      within(dialog).getByText("Checkout").closest("[aria-disabled]"),
    ).toHaveAttribute("aria-disabled", "true");
    expect(within(dialog).queryByRole("link", { name: "Checkout" })).toBeNull();
  });

  it("lists each cart line and shows a live subtotal", () => {
    addLine({
      id: "sticker",
      title: "Custom Die-Cut Stickers",
      unitPrice: 0.75,
      quantity: 2,
    });
    addLine({
      id: "keychain",
      title: "Wildflower Acrylic Keychain",
      unitPrice: 9,
      quantity: 1,
    });
    render(<CartDrawer />);
    const dialog = open();

    expect(
      within(dialog).getByRole("link", { name: "Custom Die-Cut Stickers" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("link", { name: "Wildflower Acrylic Keychain" }),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("$10.50")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("link", { name: "Checkout" }),
    ).toHaveAttribute("href", "/checkout");
  });

  it("updates the subtotal when a line's quantity changes", () => {
    addLine({ id: "sticker", unitPrice: 0.75, quantity: 2 });
    addLine({ id: "keychain", title: "Keychain", unitPrice: 9, quantity: 1 });
    render(<CartDrawer />);
    const dialog = open();

    fireEvent.click(
      within(dialog).getAllByRole("button", { name: "Increase quantity" })[0]!,
    );

    // Sticker line: (2 + 1) * 0.75 = 2.25. Subtotal: 2.25 + 9.00 = 11.25.
    expect(within(dialog).getByText("$2.25")).toBeInTheDocument();
    expect(within(dialog).getByText("$11.25")).toBeInTheDocument();
  });

  it("falls back to the empty state after removing the last line", () => {
    addLine({ id: "sticker" });
    render(<CartDrawer />);
    const dialog = open();

    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "Remove Custom Die-Cut Stickers from cart",
      }),
    );

    expect(within(dialog).getByText(/cart is empty/i)).toBeInTheDocument();
  });

  it("closes when Keep shopping is clicked", () => {
    render(<CartDrawer />);
    const dialog = open();

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Keep shopping" }),
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
