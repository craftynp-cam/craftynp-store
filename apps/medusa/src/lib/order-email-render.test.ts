import type { OrderConfirmationLine } from "@craftynp/types";

import {
  MAX_VARIABLE_CHARS,
  renderAddressHtml,
  renderOrderItemsHtml,
  renderOrderItemsText,
} from "./order-email-render";

const ORDER_URL =
  "https://thecraftynp.org/checkout/confirmation?order=order_01";

function buildLine(
  overrides: Partial<OrderConfirmationLine> = {},
): OrderConfirmationLine {
  return {
    id: "item_1",
    title: "Custom Die-Cut Stickers",
    variantTitle: null,
    thumbnail: null,
    quantity: 50,
    unitPrice: 0.75,
    lineTotal: 37.5,
    isCustomizable: false,
    details: [],
    ...overrides,
  };
}

describe("renderOrderItemsHtml", () => {
  it("escapes a shopper-supplied title, which lands in the email unescaped otherwise", () => {
    const html = renderOrderItemsHtml(
      [buildLine({ title: '<script>alert("x")</script> & co' })],
      "usd",
      ORDER_URL,
    );

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp; co");
  });

  it("escapes customization values, which are the shopper's own free text", () => {
    const html = renderOrderItemsHtml(
      [
        buildLine({
          details: [{ label: "Text", value: '"><img src=x onerror=1>' }],
        }),
      ],
      "usd",
      ORDER_URL,
    );

    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  it("renders every line when the order fits the variable budget", () => {
    const html = renderOrderItemsHtml(
      [buildLine({ id: "a" }), buildLine({ id: "b", title: "Keychain" })],
      "usd",
      ORDER_URL,
    );

    expect(html).toContain("Custom Die-Cut Stickers");
    expect(html).toContain("Keychain");
    expect(html).not.toContain("more item");
    expect(html.length).toBeLessThanOrEqual(MAX_VARIABLE_CHARS);
  });

  it("truncates to an overflow row rather than exceeding Resend's variable cap", () => {
    const lines = Array.from({ length: 40 }, (_, index) =>
      buildLine({ id: `item_${index}`, title: `Sticker pack ${index}` }),
    );

    const html = renderOrderItemsHtml(lines, "usd", ORDER_URL);

    expect(html.length).toBeLessThanOrEqual(MAX_VARIABLE_CHARS);
    expect(html).toMatch(/and \d+ more items — view your full order/);
    expect(html).toContain(ORDER_URL);
  });

  it("counts the overflow row itself against the budget", () => {
    // A line long enough that the budget is exhausted mid-order; the overflow
    // row must still fit inside the cap it is meant to keep the email under.
    const lines = Array.from({ length: 12 }, (_, index) =>
      buildLine({
        id: `item_${index}`,
        title: "A very long product name ".repeat(6),
      }),
    );

    expect(
      renderOrderItemsHtml(lines, "usd", ORDER_URL).length,
    ).toBeLessThanOrEqual(MAX_VARIABLE_CHARS);
  });
});

describe("renderOrderItemsText", () => {
  it("lists the same lines as the html without markup", () => {
    const text = renderOrderItemsText(
      [buildLine({ details: [{ label: "Text", value: "Hello" }] })],
      "usd",
    );

    expect(text).toContain("Custom Die-Cut Stickers — Qty 50 — $37.50");
    expect(text).toContain("Text: Hello");
    expect(text).not.toContain("<");
  });

  it("stays inside the variable cap too", () => {
    const lines = Array.from({ length: 60 }, (_, index) =>
      buildLine({ id: `item_${index}` }),
    );

    expect(renderOrderItemsText(lines, "usd").length).toBeLessThanOrEqual(
      MAX_VARIABLE_CHARS,
    );
  });
});

describe("renderAddressHtml", () => {
  it("escapes the recipient's own name", () => {
    const html = renderAddressHtml({
      firstName: "Jamie <b>",
      lastName: "Rivera",
      phone: null,
      address1: "123 Maple Street",
      address2: "",
      city: "Springfield",
      state: "IL",
      postalCode: "62704",
      countryCode: "us",
    });

    expect(html).toContain("Jamie &lt;b&gt; Rivera");
    expect(html).toContain("Springfield, IL 62704");
  });

  it("renders nothing when the order has no shipping address", () => {
    expect(renderAddressHtml(null)).toBe("");
  });
});
