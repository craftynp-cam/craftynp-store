import { taxLineItems } from "./route";

const PRICED = [
  { ok: true, price: { unitAmount: 28 } },
  { ok: true, price: { unitAmount: 28 } },
];

describe("taxLineItems", () => {
  it("keeps two lines on one variant apart, which Stripe requires", () => {
    const references = taxLineItems(
      [
        { variantId: "variant_01", quantity: 1 },
        { variantId: "variant_01", quantity: 2 },
      ],
      PRICED,
    ).map((line) => line.reference);

    expect(new Set(references).size).toBe(2);
  });

  it("carries each line's own amount and quantity", () => {
    expect(
      taxLineItems([{ variantId: "variant_01", quantity: 3 }], [PRICED[0]!]),
    ).toEqual([{ reference: "variant_01:0", amount: 28, quantity: 3 }]);
  });

  it("prices an unresolved line at zero rather than dropping it", () => {
    expect(
      taxLineItems([{ variantId: "variant_01", quantity: 1 }], [{ ok: false }]),
    ).toEqual([{ reference: "variant_01:0", amount: 0, quantity: 1 }]);
  });
});
