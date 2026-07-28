import { categoryHref, productHref } from "@/lib/routes";

describe("categoryHref", () => {
  it("builds a top-level category path", () => {
    expect(categoryHref("keychains")).toBe("/keychains");
  });
});

describe("productHref", () => {
  it("nests the product under its category", () => {
    expect(productHref("keychains", "wildflower-acrylic-keychain")).toBe(
      "/keychains/wildflower-acrylic-keychain",
    );
  });
});
