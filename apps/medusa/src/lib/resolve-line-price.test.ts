import { resolveLinePrice, type VariantWithPrice } from "./resolve-line-price";

const AREA_METADATA = {
  customizable: "true",
  customization_size: "optional",
  customization_size_min_inches: "2",
  customization_size_max_inches: "48",
  customization_size_rate_per_sq_inch: "0.055",
  customization_size_price_floor: "4",
};

function variant(
  calculatedAmount: number,
  metadata: Record<string, unknown> | null = null,
): VariantWithPrice {
  return {
    id: "variant_1",
    product: { metadata },
    calculated_price: {
      calculated_amount: calculatedAmount,
      original_amount: calculatedAmount,
      currency_code: "usd",
    },
  };
}

// Prices by quantity tier, so a query stands in for a Medusa price list.
function tieredQuery(tiers: Record<number, number>, metadata = AREA_METADATA) {
  return jest.fn(async ({ quantity }: { quantity: number }) => {
    const amount =
      Object.entries(tiers)
        .map(([min, price]) => [Number(min), price] as const)
        .filter(([min]) => quantity >= min)
        .sort((a, b) => b[0] - a[0])[0]?.[1] ?? 0;
    return [variant(amount, metadata)];
  });
}

describe("resolveLinePrice", () => {
  it("prices an ordinary line from the variant's calculated price", async () => {
    const query = jest.fn(async () => [variant(9)]);

    await expect(
      resolveLinePrice(query, { variantId: "variant_1", quantity: 3 }),
    ).resolves.toEqual({
      ok: true,
      price: {
        unitAmount: 9,
        originalUnitAmount: 9,
        currencyCode: "usd",
        isAreaPriced: false,
      },
    });
  });

  it("asks for the price at the ordered quantity, so a tier applies", async () => {
    const query = tieredQuery({ 1: 1.15, 100: 0.92 });

    await expect(
      resolveLinePrice(query, { variantId: "variant_1", quantity: 100 }),
    ).resolves.toMatchObject({ ok: true, price: { unitAmount: 0.92 } });

    expect(query).toHaveBeenCalledWith({
      variantIds: ["variant_1"],
      quantity: 100,
    });
  });

  it("prices a custom size from the product's rate, not the request", async () => {
    const query = tieredQuery({ 1: 1.15 });

    await expect(
      resolveLinePrice(query, {
        variantId: "variant_1",
        quantity: 1,
        dimensions: { widthInches: 8, heightInches: 10 },
      }),
    ).resolves.toEqual({
      ok: true,
      price: {
        unitAmount: 5.06,
        originalUnitAmount: null,
        currencyCode: "usd",
        isAreaPriced: true,
      },
    });
  });

  it("carries a quantity tier onto a custom size", async () => {
    const query = tieredQuery({ 1: 1.15, 100: 0.92 });

    await expect(
      resolveLinePrice(query, {
        variantId: "variant_1",
        quantity: 100,
        dimensions: { widthInches: 8, heightInches: 10 },
      }),
      // 0.92 / 1.15 = 0.8, and 5.06 * 0.8 = 4.048 -> 4.05
    ).resolves.toMatchObject({ ok: true, price: { unitAmount: 4.05 } });
  });

  it("refuses a custom size the product has no rate for", async () => {
    const query = tieredQuery(
      { 1: 1.15 },
      { ...AREA_METADATA, customization_size_rate_per_sq_inch: "" },
    );

    await expect(
      resolveLinePrice(query, {
        variantId: "variant_1",
        quantity: 1,
        dimensions: { widthInches: 8, heightInches: 10 },
      }),
    ).resolves.toMatchObject({ ok: false, reason: "unconfigured" });
  });

  it("refuses dimensions outside the product's own bounds", async () => {
    const query = tieredQuery({ 1: 1.15 });

    await expect(
      resolveLinePrice(query, {
        variantId: "variant_1",
        quantity: 1,
        dimensions: { widthInches: 8, heightInches: 500 },
      }),
    ).resolves.toMatchObject({ ok: false, reason: "bad_dimensions" });
  });

  it("refuses a variant it cannot find", async () => {
    const query = jest.fn(async () => []);

    await expect(
      resolveLinePrice(query, { variantId: "variant_gone", quantity: 1 }),
    ).resolves.toMatchObject({ ok: false, reason: "unknown_variant" });
  });

  it("refuses a variant with no price in this region", async () => {
    const query = jest.fn(async () => [
      { id: "variant_1", calculated_price: null },
    ]);

    await expect(
      resolveLinePrice(query, { variantId: "variant_1", quantity: 1 }),
    ).resolves.toMatchObject({ ok: false, reason: "unpriced" });
  });
});
