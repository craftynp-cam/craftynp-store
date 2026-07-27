import { toProductCardProps } from "@/lib/product-card";

describe("toProductCardProps", () => {
  it("maps the basic fields", () => {
    const props = toProductCardProps({
      handle: "custom-die-cut-stickers",
      title: "Custom Die-Cut Stickers",
      thumbnail: "https://example.com/sticker.png",
      categories: [{ name: "Stickers" }],
      variants: [
        {
          calculated_price: {
            calculated_amount: 0.55,
            original_amount: 0.55,
            currency_code: "usd",
          },
        },
      ],
    });

    expect(props.href).toBe("/products/custom-die-cut-stickers");
    expect(props.title).toBe("Custom Die-Cut Stickers");
    expect(props.category).toBe("Stickers");
    expect(props.imageUrl).toBe("https://example.com/sticker.png");
    expect(props.price).toBe("$0.55");
    expect(props.originalPrice).toBeUndefined();
    expect(props.isFromPrice).toBe(false);
  });

  it("picks the lowest variant price and marks it 'from' when variants differ", () => {
    const props = toProductCardProps({
      handle: "tote-bag",
      title: "Tote Bag",
      variants: [
        {
          calculated_price: {
            calculated_amount: 24,
            original_amount: 24,
            currency_code: "usd",
          },
        },
        {
          calculated_price: {
            calculated_amount: 18,
            original_amount: 18,
            currency_code: "usd",
          },
        },
      ],
    });

    expect(props.price).toBe("$18.00");
    expect(props.isFromPrice).toBe(true);
  });

  it("does not mark a single-price product as 'from'", () => {
    const props = toProductCardProps({
      handle: "tote-bag",
      title: "Tote Bag",
      variants: [
        {
          calculated_price: {
            calculated_amount: 24,
            original_amount: 24,
            currency_code: "usd",
          },
        },
        {
          calculated_price: {
            calculated_amount: 24,
            original_amount: 24,
            currency_code: "usd",
          },
        },
      ],
    });

    expect(props.isFromPrice).toBe(false);
  });

  it("detects a sale and carries the original price", () => {
    const props = toProductCardProps({
      handle: "keychain",
      title: "Wildflower Acrylic Keychain",
      variants: [
        {
          calculated_price: {
            calculated_amount: 9,
            original_amount: 12,
            currency_code: "usd",
          },
        },
      ],
    });

    expect(props.price).toBe("$9.00");
    expect(props.originalPrice).toBe("$12.00");
  });

  it("falls back gracefully when there is no thumbnail or category", () => {
    const props = toProductCardProps({
      handle: null,
      title: "Coming Soon",
      variants: [],
    });

    expect(props.imageUrl).toBeUndefined();
    expect(props.category).toBe("");
    expect(props.price).toBe("");
    expect(props.href).toBe("/products/");
  });
});
