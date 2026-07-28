import { fetchCatalogProducts, sortCatalogProducts } from "@/lib/product-list";
import type { ProductCardSourceProduct } from "@/lib/product-card";

jest.mock("../../src/lib/medusa", () => ({
  sdk: { store: { product: { list: jest.fn() } } },
}));

function product(
  title: string,
  amount: number | null,
): ProductCardSourceProduct {
  return {
    handle: title.toLowerCase(),
    title,
    categories: [{ name: "Stickers", handle: "stickers" }],
    variants:
      amount == null
        ? []
        : [
            {
              calculated_price: {
                calculated_amount: amount,
                original_amount: amount,
                currency_code: "usd",
              },
            },
          ],
  };
}

describe("sortCatalogProducts", () => {
  const products = [product("B", 20), product("A", 5), product("C", 12)];

  it("leaves Medusa's order alone for featured", () => {
    expect(
      sortCatalogProducts(products, "featured").map((p) => p.card.title),
    ).toEqual(["B", "A", "C"]);
  });

  it("leaves Medusa's order alone for newest, which is requested via order", () => {
    expect(
      sortCatalogProducts(products, "newest").map((p) => p.card.title),
    ).toEqual(["B", "A", "C"]);
  });

  it("sorts ascending by the cheapest variant's amount", () => {
    expect(
      sortCatalogProducts(products, "price-asc").map((p) => p.card.title),
    ).toEqual(["A", "C", "B"]);
  });

  it("sorts descending by the cheapest variant's amount", () => {
    expect(
      sortCatalogProducts(products, "price-desc").map((p) => p.card.title),
    ).toEqual(["B", "C", "A"]);
  });

  it("treats a product with no priced variant as amount 0", () => {
    const unpriced = product("Unpriced", null);
    const sorted = sortCatalogProducts([...products, unpriced], "price-asc");

    expect(sorted[0]?.card.title).toBe("Unpriced");
  });

  it("does not mutate the input array", () => {
    const copy = [...products];
    sortCatalogProducts(products, "price-asc");

    expect(products).toEqual(copy);
  });
});

describe("fetchCatalogProducts", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  function mockSdk() {
    return jest.requireMock<{
      sdk: { store: { product: { list: jest.Mock } } };
    }>("../../src/lib/medusa").sdk;
  }

  it("passes region_id, an optional category filter, and the resolved order", async () => {
    const sdk = mockSdk();
    sdk.store.product.list.mockResolvedValue({
      products: [],
      count: 0,
      offset: 0,
      limit: 100,
    });

    await fetchCatalogProducts({
      categoryId: "pcat_1",
      sort: "newest",
      regionId: "reg_us",
    });

    expect(sdk.store.product.list).toHaveBeenCalledWith(
      expect.objectContaining({
        category_id: ["pcat_1"],
        region_id: "reg_us",
        order: "-created_at",
      }),
    );
  });

  it("omits the category filter for the all-products view", async () => {
    const sdk = mockSdk();
    sdk.store.product.list.mockResolvedValue({
      products: [],
      count: 0,
      offset: 0,
      limit: 100,
    });

    await fetchCatalogProducts({ sort: "featured", regionId: "reg_us" });

    expect(sdk.store.product.list).toHaveBeenCalledWith(
      expect.objectContaining({ category_id: undefined }),
    );
  });

  it("maps and sorts the fetched products", async () => {
    const sdk = mockSdk();
    sdk.store.product.list.mockResolvedValue({
      products: [product("B", 20), product("A", 5)],
      count: 2,
      offset: 0,
      limit: 100,
    });

    const result = await fetchCatalogProducts({
      sort: "price-asc",
      regionId: "reg_us",
    });

    expect(result.map((p) => p.card.title)).toEqual(["A", "B"]);
  });

  it("returns an empty array and does not throw when the SDK rejects", async () => {
    const sdk = mockSdk();
    sdk.store.product.list.mockRejectedValue(new Error("backend is down"));
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await expect(
      fetchCatalogProducts({ sort: "featured", regionId: "reg_us" }),
    ).resolves.toEqual([]);

    consoleError.mockRestore();
  });
});
