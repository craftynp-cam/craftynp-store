import {
  fetchNavCategories,
  toNavCategories,
  type NavCategorySource,
} from "@/lib/categories";

jest.mock("../../src/lib/medusa", () => ({
  sdk: { store: { category: { list: jest.fn() } } },
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

    expect(toNavCategories(sources)[0]?.href).toBe("/categories/stickers");
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
      { name: "Shirts", href: "/categories/shirts" },
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
