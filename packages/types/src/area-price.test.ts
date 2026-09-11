import { areaUnitPrice } from "./area-price.js";

const BASE = {
  variantAmount: 1.15,
  ratePerSquareInch: 0.055,
  priceFloor: 4,
  widthInches: 8,
  heightInches: 10,
};

describe("areaUnitPrice", () => {
  it("prices a custom size from the rate when it clears the floor", () => {
    expect(areaUnitPrice(BASE)).toBe(5.06);
  });

  it("falls back to the floor when the rated amount is below it", () => {
    expect(areaUnitPrice({ ...BASE, widthInches: 2, heightInches: 2 })).toBe(4);
  });

  it("scales with the variant's own price, so a finish keeps its premium", () => {
    expect(areaUnitPrice({ ...BASE, variantAmount: 1.6 })).toBe(7.04);
  });

  it("applies a quantity tier ratio to the rated amount", () => {
    expect(areaUnitPrice({ ...BASE, tierRatio: 0.8 })).toBe(4.05);
  });

  it("does not let a tier ratio push the price below the floor", () => {
    expect(areaUnitPrice({ ...BASE, tierRatio: 0.1 })).toBe(4);
  });

  it("rounds the result to whole cents", () => {
    expect(
      areaUnitPrice({
        variantAmount: 1.01,
        ratePerSquareInch: 0.333,
        priceFloor: 1,
        widthInches: 3,
        heightInches: 3,
      }),
    ).toBe(3.03);
  });

  it.each([
    ["no rate", { ratePerSquareInch: null }],
    ["no floor", { priceFloor: null }],
    ["no width", { widthInches: null }],
    ["no height", { heightInches: null }],
    ["a zero rate", { ratePerSquareInch: 0 }],
    ["a negative dimension", { widthInches: -8 }],
    ["a zero tier ratio", { tierRatio: 0 }],
  ])("cannot price %s", (_label, patch) => {
    expect(areaUnitPrice({ ...BASE, ...patch })).toBeNull();
  });
});
