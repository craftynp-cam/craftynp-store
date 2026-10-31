import { parseShippingMethodData, withinShippingTolerance } from "./lib.js";

describe("parseShippingMethodData", () => {
  it("accepts a valid payload", () => {
    const result = parseShippingMethodData({
      rateId: "se-1",
      serviceCode: "usps_ground_advantage",
      quoteToken: "token.signature",
      amount: 7.42,
    });
    expect(result).not.toBeNull();
  });

  it("rejects a payload missing a field", () => {
    const result = parseShippingMethodData({
      rateId: "se-1",
      serviceCode: "usps_ground_advantage",
      quoteToken: "token.signature",
    });
    expect(result).toBeNull();
  });

  it("rejects a non-object payload", () => {
    expect(parseShippingMethodData("not an object")).toBeNull();
    expect(parseShippingMethodData(null)).toBeNull();
  });
});

describe("withinShippingTolerance", () => {
  it("accepts an exact match", () => {
    expect(withinShippingTolerance(7.42, 7.42)).toBe(true);
  });

  it("accepts a difference within the flat $0.50 floor for a cheap rate", () => {
    // 5% of $3 is $0.15, so the $0.50 floor applies.
    expect(withinShippingTolerance(3.0, 3.45)).toBe(true);
  });

  it("rejects a difference above the flat $0.50 floor for a cheap rate", () => {
    expect(withinShippingTolerance(3.0, 3.55)).toBe(false);
  });

  it("accepts a difference within 5% for an expensive rate", () => {
    // 5% of $40 is $2, above the $0.50 floor.
    expect(withinShippingTolerance(40, 41.5)).toBe(true);
  });

  it("rejects a difference above 5% for an expensive rate", () => {
    expect(withinShippingTolerance(40, 42.5)).toBe(false);
  });

  it("rejects a large increase", () => {
    expect(withinShippingTolerance(7.42, 25.0)).toBe(false);
  });
});
