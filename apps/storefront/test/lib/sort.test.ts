import { medusaOrder, parseSort, sortHref } from "@/lib/sort";

describe("parseSort", () => {
  it("recognises each valid sort id", () => {
    expect(parseSort("featured")).toBe("featured");
    expect(parseSort("price-asc")).toBe("price-asc");
    expect(parseSort("price-desc")).toBe("price-desc");
    expect(parseSort("newest")).toBe("newest");
  });

  it("falls back to featured for an unrecognised value", () => {
    expect(parseSort("bogus")).toBe("featured");
  });

  it("falls back to featured when absent", () => {
    expect(parseSort(undefined)).toBe("featured");
  });

  it("reads the first value out of an array param", () => {
    expect(parseSort(["price-asc", "newest"])).toBe("price-asc");
  });

  it("falls back to featured for an empty array", () => {
    expect(parseSort([])).toBe("featured");
  });
});

describe("sortHref", () => {
  it("omits the query param for featured", () => {
    expect(sortHref("/products", "featured")).toBe("/products");
  });

  it("appends ?sort= for every other value", () => {
    expect(sortHref("/products", "price-asc")).toBe("/products?sort=price-asc");
    expect(sortHref("/shirts", "newest")).toBe("/shirts?sort=newest");
  });
});

describe("medusaOrder", () => {
  it("maps newest to -created_at", () => {
    expect(medusaOrder("newest")).toBe("-created_at");
  });

  it("leaves every other sort to Medusa's default order", () => {
    expect(medusaOrder("featured")).toBeUndefined();
    expect(medusaOrder("price-asc")).toBeUndefined();
    expect(medusaOrder("price-desc")).toBeUndefined();
  });
});
