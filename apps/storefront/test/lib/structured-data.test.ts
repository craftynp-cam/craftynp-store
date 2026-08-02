import { serializeJsonLd, toProductJsonLd } from "@/lib/structured-data";
import type { ProductDetail } from "@/lib/product";

function makeProduct(overrides: Partial<ProductDetail> = {}): ProductDetail {
  return {
    id: "prod_1",
    href: "/keychains/wildflower-acrylic-keychain",
    title: "Wildflower Acrylic Keychain",
    description: "A ready-made favorite.",
    categoryName: "Keychains",
    categoryHandle: "keychains",
    images: [{ url: "https://example.com/keychain.png", alt: "Keychain" }],
    options: [],
    variants: [
      {
        id: "var_1",
        sku: "KEYCHAIN-BLUSH",
        optionValueIds: [],
        availability: "in_stock",
        price: "$9.00",
        originalPrice: undefined,
        savingsLabel: undefined,
        calculatedAmount: 9,
        currencyCode: "usd",
      },
    ],
    ...overrides,
  };
}

describe("toProductJsonLd", () => {
  it("builds a schema.org Product with the basic fields", () => {
    const jsonLd = toProductJsonLd(makeProduct());

    expect(jsonLd["@context"]).toBe("https://schema.org");
    expect(jsonLd["@type"]).toBe("Product");
    expect(jsonLd.name).toBe("Wildflower Acrylic Keychain");
    expect(jsonLd.description).toBe("A ready-made favorite.");
    expect(jsonLd.image).toEqual(["https://example.com/keychain.png"]);
  });

  it("builds one Offer per priced variant", () => {
    const jsonLd = toProductJsonLd(makeProduct());
    const offers = jsonLd.offers as Record<string, unknown>[];

    expect(offers).toHaveLength(1);
    expect(offers[0]).toMatchObject({
      "@type": "Offer",
      sku: "KEYCHAIN-BLUSH",
      price: "9.00",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      url: "/keychains/wildflower-acrylic-keychain",
    });
  });

  it("maps low and out of stock to their schema.org availability values", () => {
    const lowStock = toProductJsonLd(
      makeProduct({
        variants: [
          {
            id: "var_1",
            sku: null,
            optionValueIds: [],
            availability: "low_stock",
            price: "$9.00",
            originalPrice: undefined,
            savingsLabel: undefined,
            calculatedAmount: 9,
            currencyCode: "usd",
          },
        ],
      }),
    );
    const outOfStock = toProductJsonLd(
      makeProduct({
        variants: [
          {
            id: "var_1",
            sku: null,
            optionValueIds: [],
            availability: "out_of_stock",
            price: "$9.00",
            originalPrice: undefined,
            savingsLabel: undefined,
            calculatedAmount: 9,
            currencyCode: "usd",
          },
        ],
      }),
    );

    const lowOffers = lowStock.offers as Record<string, unknown>[];
    const outOffers = outOfStock.offers as Record<string, unknown>[];
    expect(lowOffers[0]?.availability).toBe(
      "https://schema.org/LimitedAvailability",
    );
    expect(outOffers[0]?.availability).toBe("https://schema.org/OutOfStock");
  });

  it("excludes a variant with no resolved price", () => {
    const jsonLd = toProductJsonLd(
      makeProduct({
        variants: [
          {
            id: "var_1",
            sku: null,
            optionValueIds: [],
            availability: "in_stock",
            price: "",
            originalPrice: undefined,
            savingsLabel: undefined,
            calculatedAmount: 0,
            currencyCode: "usd",
          },
        ],
      }),
    );

    expect(jsonLd.offers).toBeUndefined();
  });
});

describe("serializeJsonLd", () => {
  it("escapes < so a description cannot close the script tag", () => {
    const serialized = serializeJsonLd(
      toProductJsonLd(
        makeProduct({ description: "</script><script>alert(1)</script>" }),
      ),
    );

    expect(serialized).not.toContain("<");
    expect(JSON.parse(serialized)).toMatchObject({
      description: "</script><script>alert(1)</script>",
    });
  });
});
