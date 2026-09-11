import {
  CART_STORAGE_KEY,
  addCartLine,
  type CartLine,
  cartLineCount,
  cartSubtotal,
  clearCart,
  readCart,
  removeCartLine,
  renderableImageUrl,
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

  it("drops a stale price quote when the quantity changes", () => {
    // The quote was issued for the old quantity, and a quantity break makes
    // that a different unit price. Keeping it would let prepare-cart charge a
    // tier the shopper no longer qualifies for.
    addCartLine(makeLine({ quantity: 10, priceQuoteToken: "quote-for-10" }));

    setCartLineQuantity("sticker", 50);

    expect(readCart().lines[0]?.quantity).toBe(50);
    expect(readCart().lines[0]?.priceQuoteToken).toBeUndefined();
  });

  it("keeps the quote when the quantity is set to what it already was", () => {
    addCartLine(makeLine({ quantity: 10, priceQuoteToken: "quote-for-10" }));

    setCartLineQuantity("sticker", 10);

    expect(readCart().lines[0]?.priceQuoteToken).toBe("quote-for-10");
  });

  it("holds a line at its own minimum, not at one", () => {
    addCartLine(makeLine({ quantity: 50, minOrderQuantity: 50 }));

    setCartLineQuantity("sticker", 1);

    expect(readCart().lines[0]?.quantity).toBe(50);
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

describe("renderableImageUrl", () => {
  const MEDIA = "http://media.test/craftynp-media";

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_MEDIA_BASE_URL;
    delete process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL;
  });

  it("drops a host next/image is not configured for, rather than crashing the page", () => {
    process.env.NEXT_PUBLIC_MEDIA_BASE_URL = MEDIA;

    expect(
      renderableImageUrl("https://elsewhere.test/sweatshirt.png"),
    ).toBeUndefined();
  });

  it("keeps a host that is configured", () => {
    process.env.NEXT_PUBLIC_MEDIA_BASE_URL = MEDIA;

    expect(renderableImageUrl(`${MEDIA}/tumbler.png`)).toBe(
      `${MEDIA}/tumbler.png`,
    );
  });

  it("keeps the backend's own host", () => {
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL = "http://backend.test:9000";

    expect(renderableImageUrl("http://backend.test:9000/static/a.png")).toBe(
      "http://backend.test:9000/static/a.png",
    );
  });

  it("keeps a relative path, which needs no host at all", () => {
    process.env.NEXT_PUBLIC_MEDIA_BASE_URL = MEDIA;

    expect(renderableImageUrl("/placeholder.png")).toBe("/placeholder.png");
  });

  it("keeps everything when nothing is configured to compare against", () => {
    expect(renderableImageUrl("https://elsewhere.test/a.png")).toBe(
      "https://elsewhere.test/a.png",
    );
  });

  it("strips an unreachable image off a line stored by an earlier session", async () => {
    process.env.NEXT_PUBLIC_MEDIA_BASE_URL = MEDIA;
    window.localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify({
        lines: [makeLine({ imageUrl: "https://elsewhere.test/old.png" })],
      }),
    );

    jest.resetModules();
    const freshCart = await import("@/lib/cart");
    const lines = freshCart.readCart().lines;

    expect(lines).toHaveLength(1);
    expect(lines[0]?.title).toBe("Custom Die-Cut Stickers");
    expect(lines[0]?.imageUrl).toBeUndefined();
  });
});
