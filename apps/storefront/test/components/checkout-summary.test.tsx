import { act, fireEvent, render, screen, within } from "@testing-library/react";

import { CheckoutSummary } from "@/components";
import { addCartLine, clearCart, type CartLine } from "@/lib/cart";
import { setCartDrawerOpen } from "@/lib/cart-drawer";
import { clearCheckoutDraft, patchCheckoutDraft } from "@/lib/checkout-draft";

function addLine(overrides: Partial<CartLine> = {}) {
  act(() => {
    addCartLine({
      id: "sticker",
      href: "/products/sticker",
      title: "Custom Die-Cut Stickers",
      unitPrice: 0.75,
      currencyCode: "usd",
      quantity: 2,
      ...overrides,
    });
  });
}

function totalsRegion(): HTMLElement {
  return screen.getByText("Total").closest("div")!.parentElement as HTMLElement;
}

describe("CheckoutSummary", () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearCart();
    clearCheckoutDraft();
    setCartDrawerOpen(false);
  });

  it("shows the line count in the heading", () => {
    addLine({ quantity: 3 });
    render(<CheckoutSummary onEditCart={jest.fn()} />);

    expect(
      screen.getByRole("heading", { level: 2, name: /Your cart/ }),
    ).toHaveTextContent("Your cart (3)");
  });

  it("renders one list item per line", () => {
    addLine({ id: "sticker" });
    addLine({ id: "keychain", title: "Keychain" });
    render(<CheckoutSummary onEditCart={jest.fn()} />);

    const list = screen.getByRole("list");
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
  });

  it("formats the subtotal with formatMoney", () => {
    addLine({ unitPrice: 0.75, quantity: 2 });
    render(<CheckoutSummary onEditCart={jest.fn()} />);

    const totals = totalsRegion();
    expect(within(totals).getByText("Subtotal").nextSibling).toHaveTextContent(
      "$1.50",
    );
  });

  it("renders a shipping placeholder and no tax row when no rate is chosen", () => {
    addLine();
    render(<CheckoutSummary onEditCart={jest.fn()} />);

    const totals = totalsRegion();
    expect(within(totals).getByText("Shipping").nextSibling).toHaveTextContent(
      "Calculated above",
    );
    expect(within(totals).queryByText(/Tax/)).not.toBeInTheDocument();
  });

  it("sets the total equal to the subtotal when no rate is chosen", () => {
    addLine({ unitPrice: 0.75, quantity: 2 });
    render(<CheckoutSummary onEditCart={jest.fn()} />);

    expect(within(totalsRegion()).getAllByText("$1.50")).toHaveLength(2);
  });

  it("shows the chosen shipping rate and sums it into the total", () => {
    addLine({ unitPrice: 0.75, quantity: 2 });
    act(() => {
      patchCheckoutDraft({
        shippingRateId: "rate_standard",
        shippingRateAmount: 7.42,
        shippingRateCurrency: "usd",
      });
    });
    render(<CheckoutSummary onEditCart={jest.fn()} />);

    const totals = totalsRegion();
    expect(within(totals).getByText("Shipping").nextSibling).toHaveTextContent(
      "$7.42",
    );
    expect(within(totals).getByText("Total").nextSibling).toHaveTextContent(
      "$8.92",
    );
  });

  it("writes quantity changes through to the cart and updates the total", () => {
    addLine({ unitPrice: 1, quantity: 1 });
    render(<CheckoutSummary onEditCart={jest.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /Increase/i }));

    expect(within(totalsRegion()).getAllByText("$2.00")).toHaveLength(2);
  });

  it("removes a line", () => {
    addLine({ id: "sticker", title: "Custom Die-Cut Stickers" });
    render(<CheckoutSummary onEditCart={jest.fn()} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Remove Custom Die-Cut Stickers from cart",
      }),
    );

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "Your cart (0)",
    );
  });

  it("calls onEditCart from the Edit control", () => {
    addLine();
    const onEditCart = jest.fn();
    render(<CheckoutSummary onEditCart={onEditCart} />);

    fireEvent.click(screen.getByRole("button", { name: "Edit your cart" }));

    expect(onEditCart).toHaveBeenCalledTimes(1);
  });

  it("renders an empty cart without crashing", () => {
    render(<CheckoutSummary onEditCart={jest.fn()} />);

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "Your cart (0)",
    );
    expect(within(totalsRegion()).getAllByText("$0.00")).toHaveLength(2);
  });
});
