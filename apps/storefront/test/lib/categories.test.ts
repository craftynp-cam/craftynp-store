import { FetchError } from "@medusajs/js-sdk";

import { MedusaUnavailableError } from "@/lib/medusa-error";

import {
  fetchCatalogSidebar,
  fetchNavCategories,
  fetchShowcaseCategories,
  toCategoryImage,
  toNavCategories,
  toShowcaseSources,
  toSidebarCategories,
  type NavCategorySource,
  type ProductCategorySource,
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

  it("throws when the backend itself is unreachable", async () => {
    const { sdk } = jest.requireMock<{
      sdk: { store: { category: { list: jest.Mock } } };
    }>("../../src/lib/medusa");
    sdk.store.category.list.mockRejectedValue(new TypeError("fetch failed"));

    await expect(fetchNavCategories()).rejects.toThrow(MedusaUnavailableError);
  });

  it("returns an empty array and does not throw when the request itself is rejected", async () => {
    const { sdk } = jest.requireMock<{
      sdk: { store: { category: { list: jest.Mock } } };
    }>("../../src/lib/medusa");
    sdk.store.category.list.mockRejectedValue(
      new FetchError("bad filter", "Bad Request", 400),
    );
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

describe("toCategoryImage", () => {
  it("passes a set image_url and image_alt through", () => {
    expect(
      toCategoryImage({
        image_url: "https://cdn.example/shirts.jpg",
        image_alt: "A folded shirt",
      }),
    ).toEqual({
      imageUrl: "https://cdn.example/shirts.jpg",
      imageAlt: "A folded shirt",
    });
  });

  it.each([
    ["blank", ""],
    ["whitespace only", "   "],
    ["a number", 42],
    ["an object", { url: "https://cdn.example/shirts.jpg" }],
    ["null", null],
  ])("degrades a %s image_url to an empty url", (_label, imageUrl) => {
    expect(toCategoryImage({ image_url: imageUrl }).imageUrl).toBe("");
  });

  it("drops the alt text when the url degrades", () => {
    expect(
      toCategoryImage({ image_url: "  ", image_alt: "A folded shirt" }),
    ).toEqual({ imageUrl: "", imageAlt: "" });
  });

  it("falls back to an empty alt when only the url is set", () => {
    expect(toCategoryImage({ image_url: "https://cdn.example/s.jpg" })).toEqual(
      {
        imageUrl: "https://cdn.example/s.jpg",
        imageAlt: "",
      },
    );
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["empty", {}],
  ])("is safe when metadata is %s", (_label, metadata) => {
    expect(toCategoryImage(metadata)).toEqual({ imageUrl: "", imageAlt: "" });
  });
});

describe("toShowcaseSources", () => {
  it("keeps the id and the category image alongside the mapped name and href", () => {
    const sources: ShowcaseCategorySource[] = [
      {
        id: "pcat_1",
        name: "Shirts",
        handle: "shirts",
        metadata: {
          image_url: "https://cdn.example/shirts.jpg",
          image_alt: "A folded shirt",
        },
      },
    ];

    expect(toShowcaseSources(sources)).toEqual([
      {
        id: "pcat_1",
        name: "Shirts",
        href: "/shirts",
        imageUrl: "https://cdn.example/shirts.jpg",
        imageAlt: "A folded shirt",
      },
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

describe("toSidebarCategories", () => {
  it("counts products per category and carries a per-category handle", () => {
    const categories: ShowcaseCategorySource[] = [
      { id: "pcat_1", name: "Shirts", handle: "shirts" },
      { id: "pcat_2", name: "Pants", handle: "pants" },
    ];
    const products: ProductCategorySource[] = [
      { categories: [{ id: "pcat_1" }] },
      { categories: [{ id: "pcat_1" }] },
      { categories: [{ id: "pcat_2" }] },
    ];

    expect(toSidebarCategories(categories, products)).toEqual({
      totalCount: 3,
      categories: [
        {
          id: "pcat_2",
          name: "Pants",
          handle: "pants",
          href: "/pants",
          productCount: 1,
        },
        {
          id: "pcat_1",
          name: "Shirts",
          handle: "shirts",
          href: "/shirts",
          productCount: 2,
        },
      ],
    });
  });

  it("gives a category with no matching products a count of 0", () => {
    const categories: ShowcaseCategorySource[] = [
      { id: "pcat_1", name: "Banners", handle: "banners" },
    ];

    expect(toSidebarCategories(categories, []).categories).toEqual([
      {
        id: "pcat_1",
        name: "Banners",
        handle: "banners",
        href: "/banners",
        productCount: 0,
      },
    ]);
  });

  it("ignores a product with no category", () => {
    const categories: ShowcaseCategorySource[] = [
      { id: "pcat_1", name: "Shirts", handle: "shirts" },
    ];
    const products: ProductCategorySource[] = [{ categories: [] }, {}];

    expect(toSidebarCategories(categories, products).totalCount).toBe(2);
    expect(
      toSidebarCategories(categories, products).categories[0]?.productCount,
    ).toBe(0);
  });
});

describe("fetchCatalogSidebar", () => {
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

  it("attaches a productCount per category and a total from the product count", async () => {
    const sdk = mockSdk();
    sdk.store.category.list.mockResolvedValue({
      product_categories: [{ id: "pcat_1", name: "Shirts", handle: "shirts" }],
      count: 1,
      offset: 0,
      limit: 100,
    });
    sdk.store.product.list.mockResolvedValue({
      products: [{ id: "prod_1", categories: [{ id: "pcat_1" }] }],
      count: 8,
      offset: 0,
      limit: 100,
    });

    expect(await fetchCatalogSidebar()).toEqual({
      totalCount: 8,
      categories: [
        {
          id: "pcat_1",
          name: "Shirts",
          handle: "shirts",
          href: "/shirts",
          productCount: 1,
        },
      ],
    });
  });

  it("throws when the backend itself is unreachable", async () => {
    const sdk = mockSdk();
    sdk.store.category.list.mockRejectedValue(new TypeError("fetch failed"));
    sdk.store.product.list.mockResolvedValue({
      products: [],
      count: 0,
      offset: 0,
      limit: 100,
    });

    await expect(fetchCatalogSidebar()).rejects.toThrow(MedusaUnavailableError);
  });

  it("returns an empty sidebar and does not throw when the request itself is rejected", async () => {
    const sdk = mockSdk();
    sdk.store.category.list.mockRejectedValue(
      new FetchError("bad filter", "Bad Request", 400),
    );
    sdk.store.product.list.mockResolvedValue({
      products: [],
      count: 0,
      offset: 0,
      limit: 100,
    });
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await expect(fetchCatalogSidebar()).resolves.toEqual({
      totalCount: 0,
      categories: [],
    });

    consoleError.mockRestore();
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
      {
        name: "Shirts",
        href: "/shirts",
        productCount: 4,
        imageUrl: "",
        imageAlt: "",
      },
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
      {
        name: "Pants",
        href: "/pants",
        productCount: 5,
        imageUrl: "",
        imageAlt: "",
      },
      {
        name: "Shirts",
        href: "/shirts",
        productCount: 2,
        imageUrl: "",
        imageAlt: "",
      },
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
      {
        name: "Shirts",
        href: "/shirts",
        productCount: 0,
        imageUrl: "",
        imageAlt: "",
      },
    ]);

    consoleError.mockRestore();
  });

  it("throws when the backend itself is unreachable", async () => {
    const sdk = mockSdk();
    sdk.store.category.list.mockRejectedValue(new TypeError("fetch failed"));

    await expect(fetchShowcaseCategories()).rejects.toThrow(
      MedusaUnavailableError,
    );
  });

  it("returns an empty array and does not throw when the category list request is rejected", async () => {
    const sdk = mockSdk();
    sdk.store.category.list.mockRejectedValue(
      new FetchError("bad filter", "Bad Request", 400),
    );
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await expect(fetchShowcaseCategories()).resolves.toEqual([]);

    consoleError.mockRestore();
  });
});
