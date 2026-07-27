import { formatMoney } from "@/lib/money";

describe("formatMoney", () => {
  it("formats a decimal amount as currency", () => {
    expect(formatMoney(9, "usd")).toBe("$9.00");
  });

  it("uppercases a lowercase currency code", () => {
    expect(formatMoney(12.5, "usd")).toBe("$12.50");
  });

  it("supports a non-USD currency", () => {
    expect(formatMoney(9, "eur")).toBe("€9.00");
  });
});
