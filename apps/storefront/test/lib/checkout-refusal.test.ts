import type { CartLine } from "@/lib/cart";
import { lineProblems, refusalsFromBody } from "@/lib/checkout-refusal";

function line(overrides: Partial<CartLine>): CartLine {
  return {
    id: "variant_custom",
    lineId: "line-a",
    href: "/signs/banner",
    title: "Custom Banner",
    unitPrice: 12,
    currencyCode: "usd",
    quantity: 1,
    ...overrides,
  };
}

describe("lineProblems", () => {
  const sent = [
    line({
      lineId: "line-sized",
      details: [
        { label: "Artwork", value: "logo.png" },
        { label: "Size", value: "8″ × 10″" },
      ],
    }),
    line({
      lineId: "line-file",
      details: [{ label: "Artwork", value: "poster.png" }],
    }),
    line({ lineId: "line-plain", href: "/mugs/mug", title: "Mug" }),
  ];

  it("maps each refused request index to the cart line that was sent there", () => {
    expect(
      lineProblems(sent, [
        {
          error: "invalid_customization",
          reason: "artwork_not_found",
          line: 2,
        },
        { error: "invalid_price_quote", reason: "expired", line: 0 },
        { error: "invalid_customization", reason: "rejected", line: 1 },
      ])?.map(({ lineId, itemName, editHref }) => ({
        lineId,
        itemName,
        editHref,
      })),
    ).toEqual([
      {
        lineId: "line-plain",
        itemName: "Mug",
        editHref: "/mugs/mug?edit=line-plain",
      },
      {
        lineId: "line-sized",
        itemName: "Custom Banner (8″ × 10″)",
        editHref: "/signs/banner?edit=line-sized",
      },
      {
        lineId: "line-file",
        itemName: "Custom Banner (poster.png)",
        editHref: "/signs/banner?edit=line-file",
      },
    ]);
  });

  it("gives up on an index the sent lines do not have", () => {
    expect(
      lineProblems(sent, [
        { error: "invalid_price_quote", reason: "expired", line: 3 },
      ]),
    ).toBeNull();
  });
});

describe("refusalsFromBody", () => {
  it("reads the proxy's refused lines", () => {
    expect(
      refusalsFromBody({
        error: "invalid_price_quote",
        reason: "expired",
        line: 0,
        lines: [{ error: "invalid_price_quote", reason: "expired", line: 0 }],
      }),
    ).toEqual([{ error: "invalid_price_quote", reason: "expired", line: 0 }]);
  });

  it.each([
    ["a body with no lines", { error: "invalid_body" }],
    ["an empty list", { lines: [] }],
    [
      "a reason it has no words for",
      { lines: [{ error: "invalid_price_quote", reason: "haggled", line: 0 }] },
    ],
    ["no body at all", null],
  ])("reads nothing from %s", (_case, body) => {
    expect(refusalsFromBody(body)).toBeNull();
  });
});
