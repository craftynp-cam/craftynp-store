import {
  addCartLine,
  type CartLine,
  cartLineCount,
  cartSubtotal,
  clearCart,
  readCart,
  removeCartLine,
  setCartLineQuantity,
} from "@/lib/cart";

function makeLine(overrides: Partial<CartLine> = {}): CartLine {
  return {
    id: "sticker",
    href: "/products/sticker",
    title: "Custom Die-Cut Stickers",
    unitPrice: 0.75,
    currencyCode: "usd",
    quantity: 1,
    ...overrides,
  };
}

describe("cart", () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearCart();
  });

  it("starts empty", () => {
    expect(readCart()).toEqual({ lines: [] });
  });

  it("adds a new line", () => {
    addCartLine(makeLine());

    expect(readCart().lines).toEqual([makeLine()]);
  });

  it("merges an identical configuration into the existing line instead of creating a second one", () => {
    addCartLine(makeLine({ quantity: 2 }));
    addCartLine(makeLine({ quantity: 3 }));

    const cart = readCart();
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0]?.quantity).toBe(5);
  });

  it("keeps two lines with different ids separate", () => {
    addCartLine(makeLine({ id: "sticker" }));
    addCartLine(makeLine({ id: "keychain", title: "Keychain" }));

    expect(readCart().lines).toHaveLength(2);
  });

  it("sets a line's quantity, clamped to at least 1", () => {
    addCartLine(makeLine({ quantity: 1 }));

    setCartLineQuantity("sticker", 5);
    expect(readCart().lines[0]?.quantity).toBe(5);

    setCartLineQuantity("sticker", -3);
    expect(readCart().lines[0]?.quantity).toBe(1);
  });

  it("removes a line", () => {
    addCartLine(makeLine({ id: "sticker" }));
    addCartLine(makeLine({ id: "keychain", title: "Keychain" }));

    removeCartLine("sticker");

    expect(readCart().lines.map((line) => line.id)).toEqual(["keychain"]);
  });

  it("returns a referentially stable snapshot across reads with no intervening write", () => {
    addCartLine(makeLine());

    const first = readCart();
    const second = readCart();

    expect(first).toBe(second);
  });

  it("degrades to an empty cart when localStorage holds malformed data", () => {
    window.localStorage.setItem("craftynp-cart", "not json");

    expect(readCart()).toEqual({ lines: [] });
  });

  it("degrades to an empty cart when localStorage holds an unrelated shape", () => {
    window.localStorage.setItem(
      "craftynp-cart",
      JSON.stringify({ foo: "bar" }),
    );

    expect(readCart()).toEqual({ lines: [] });
  });

  it("computes the line count across quantities", () => {
    addCartLine(makeLine({ id: "sticker", quantity: 2 }));
    addCartLine(makeLine({ id: "keychain", quantity: 3 }));

    expect(cartLineCount(readCart())).toBe(5);
  });

  it("computes the subtotal from unit price and quantity", () => {
    addCartLine(makeLine({ id: "sticker", unitPrice: 0.75, quantity: 2 }));
    addCartLine(
      makeLine({
        id: "keychain",
        unitPrice: 9,
        quantity: 1,
        currencyCode: "usd",
      }),
    );

    expect(cartSubtotal(readCart())).toEqual({
      amount: 10.5,
      currencyCode: "usd",
    });
  });

  it("clears the cart", () => {
    addCartLine(makeLine());
    clearCart();

    expect(readCart()).toEqual({ lines: [] });
  });
});
