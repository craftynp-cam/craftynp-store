import {
  fetchNavCategories,
  fetchShowcaseCategories,
  toNavCategories,
  toShowcaseSources,
  type NavCategorySource,
  type ShowcaseCategorySource,
} from "@/lib/categories";

jest.mock("../../src/lib/medusa", () => ({
  sdk: {
    store: { category: { list: jest.fn() }, product: { list: jest.fn() } },
  },
}));

describe("toNavCategories", () => {
  it("sorts alphabetically regardless of input order", () => {
    const sources: NavCategorySource[] = [
      { name: "Shirts", handle: "shirts" },
      { name: "Merch", handle: "merch" },
      { name: "Pants", handle: "pants" },
    ];

    expect(toNavCategories(sources).map((c) => c.name)).toEqual([
      "Merch",
      "Pants",
      "Shirts",
    ]);
  });

  it("builds the href from the handle", () => {
    const sources: NavCategorySource[] = [
      { name: "Stickers", handle: "stickers" },
    ];

    expect(toNavCategories(sources)[0]?.href).toBe("/stickers");
  });

  it("drops categories that have a parent", () => {
    const sources: NavCategorySource[] = [
      { name: "Shirts", handle: "shirts" },
      {
        name: "Long Sleeve",
        handle: "long-sleeve",
        parent_category_id: "pcat_1",
      },
    ];

    expect(toNavCategories(sources).map((c) => c.name)).toEqual(["Shirts"]);
  });

  it("keeps a category whose parent_category_id is undefined", () => {
    const sources: NavCategorySource[] = [
      { name: "Shirts", handle: "shirts", parent_category_id: undefined },
    ];

    expect(toNavCategories(sources)).toHaveLength(1);
  });

  it("keeps a category whose parent_category_id is explicitly null", () => {
    const sources: NavCategorySource[] = [
      { name: "Shirts", handle: "shirts", parent_category_id: null },
    ];

    expect(toNavCategories(sources)).toHaveLength(1);
  });

  it("drops entries with an empty name or handle", () => {
    const sources: NavCategorySource[] = [
      { name: "", handle: "no-name" },
      { name: "No Handle", handle: "" },
      { name: "Shirts", handle: "shirts" },
    ];

    expect(toNavCategories(sources).map((c) => c.name)).toEqual(["Shirts"]);
  });

  it("returns an empty array for an empty input", () => {
    expect(toNavCategories([])).toEqual([]);
  });

  it("does not mutate its input", () => {
    const sources: NavCategorySource[] = [
      { name: "Shirts", handle: "shirts" },
      { name: "Merch", handle: "merch" },
    ];
    const copy = [...sources];

    toNavCategories(sources);

    expect(sources).toEqual(copy);
  });
});

describe("fetchNavCategories", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it("maps a successful response through toNavCategories", async () => {
    const { sdk } = jest.requireMock<{
      sdk: { store: { category: { list: jest.Mock } } };
    }>("../../src/lib/medusa");
    sdk.store.category.list.mockResolvedValue({
      product_categories: [{ name: "Shirts", handle: "shirts" }],
      count: 1,
      offset: 0,
      limit: 100,
    });

    expect(await fetchNavCategories()).toEqual([
      { name: "Shirts", href: "/shirts" },
    ]);
  });

  it("returns an empty array and does not throw when the SDK rejects", async () => {
    const { sdk } = jest.requireMock<{
      sdk: { store: { category: { list: jest.Mock } } };
    }>("../../src/lib/medusa");
    sdk.store.category.list.mockRejectedValue(new Error("backend is down"));
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await expect(fetchNavCategories()).resolves.toEqual([]);

    consoleError.mockRestore();
  });

  it("requests parent_category_id so top-level filtering can work", async () => {
    const { sdk } = jest.requireMock<{
      sdk: { store: { category: { list: jest.Mock } } };
    }>("../../src/lib/medusa");
    sdk.store.category.list.mockResolvedValue({
      product_categories: [],
      count: 0,
      offset: 0,
      limit: 100,
    });

    await fetchNavCategories();

    expect(sdk.store.category.list).toHaveBeenCalledWith(
      expect.objectContaining({
        fields: expect.stringContaining("parent_category_id"),
      }),
    );
  });
});

describe("toShowcaseSources", () => {
  it("keeps the id alongside the mapped name and href", () => {
    const sources: ShowcaseCategorySource[] = [
      { id: "pcat_1", name: "Shirts", handle: "shirts" },
    ];

    expect(toShowcaseSources(sources)).toEqual([
      { id: "pcat_1", name: "Shirts", href: "/shirts" },
    ]);
  });

  it("applies the same top-level filter and sort as toNavCategories", () => {
    const sources: ShowcaseCategorySource[] = [
      { id: "pcat_2", name: "Pants", handle: "pants" },
      { id: "pcat_1", name: "Merch", handle: "merch" },
      {
        id: "pcat_3",
        name: "Long Sleeve",
        handle: "long-sleeve",
        parent_category_id: "pcat_2",
      },
    ];

    expect(toShowcaseSources(sources).map((c) => c.name)).toEqual([
      "Merch",
      "Pants",
    ]);
  });
});

describe("fetchShowcaseCategories", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  function mockSdk() {
    return jest.requireMock<{
      sdk: {
        store: {
          category: { list: jest.Mock };
          product: { list: jest.Mock };
        };
      };
    }>("../../src/lib/medusa").sdk;
  }

  it("attaches a product count per category", async () => {
    const sdk = mockSdk();
    sdk.store.category.list.mockResolvedValue({
      product_categories: [{ id: "pcat_1", name: "Shirts", handle: "shirts" }],
      count: 1,
      offset: 0,
      limit: 100,
    });
    sdk.store.product.list.mockResolvedValue({
      products: [],
      count: 4,
      offset: 0,
      limit: 1,
    });

    expect(await fetchShowcaseCategories()).toEqual([
      { name: "Shirts", href: "/shirts", productCount: 4 },
    ]);
    expect(sdk.store.product.list).toHaveBeenCalledWith(
      expect.objectContaining({ category_id: ["pcat_1"] }),
    );
  });

  it("fetches counts for every category in parallel", async () => {
    const sdk = mockSdk();
    sdk.store.category.list.mockResolvedValue({
      product_categories: [
        { id: "pcat_1", name: "Shirts", handle: "shirts" },
        { id: "pcat_2", name: "Pants", handle: "pants" },
      ],
      count: 2,
      offset: 0,
      limit: 100,
    });
    sdk.store.product.list.mockImplementation(
      async ({ category_id }: { category_id: string[] }) => ({
        products: [],
        count: category_id[0] === "pcat_1" ? 2 : 5,
        offset: 0,
        limit: 1,
      }),
    );

    const categories = await fetchShowcaseCategories();

    // toShowcaseSources sorts alphabetically, so Pants precedes Shirts.
    expect(categories).toEqual([
      { name: "Pants", href: "/pants", productCount: 5 },
      { name: "Shirts", href: "/shirts", productCount: 2 },
    ]);
  });

  it("degrades a single category's count to 0 without losing the slide", async () => {
    const sdk = mockSdk();
    sdk.store.category.list.mockResolvedValue({
      product_categories: [{ id: "pcat_1", name: "Shirts", handle: "shirts" }],
      count: 1,
      offset: 0,
      limit: 100,
    });
    sdk.store.product.list.mockRejectedValue(new Error("backend is down"));
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    expect(await fetchShowcaseCategories()).toEqual([
      { name: "Shirts", href: "/shirts", productCount: 0 },
    ]);

    consoleError.mockRestore();
  });

  it("returns an empty array and does not throw when the category list rejects", async () => {
    const sdk = mockSdk();
    sdk.store.category.list.mockRejectedValue(new Error("backend is down"));
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await expect(fetchShowcaseCategories()).resolves.toEqual([]);

    consoleError.mockRestore();
  });
});
