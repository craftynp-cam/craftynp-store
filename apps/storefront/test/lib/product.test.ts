import { fetchProductByHandle, toProductDetail } from "@/lib/product";

jest.mock("../../src/lib/medusa", () => ({
  sdk: { store: { product: { list: jest.fn() } } },
}));

describe("toProductDetail", () => {
  it("maps the basic fields, including the nested category href", () => {
    const detail = toProductDetail({
      id: "prod_1",
      handle: "wildflower-acrylic-keychain",
      title: "Wildflower Acrylic Keychain",
      description: "A ready-made favorite.",
      categories: [{ name: "Keychains", handle: "keychains" }],
      images: [{ url: "https://example.com/keychain.png" }],
      options: [],
      variants: [
        {
          id: "var_1",
          title: "Blush",
          calculated_price: {
            calculated_amount: 9,
            original_amount: 9,
            currency_code: "usd",
          },
        },
      ],
    });

    expect(detail.href).toBe("/keychains/wildflower-acrylic-keychain");
    expect(detail.title).toBe("Wildflower Acrylic Keychain");
    expect(detail.categoryName).toBe("Keychains");
    expect(detail.categoryHandle).toBe("keychains");
    expect(detail.images).toEqual([
      {
        url: "https://example.com/keychain.png",
        alt: "Wildflower Acrylic Keychain",
      },
    ]);
    expect(detail.variants[0]?.price).toBe("$9.00");
    expect(detail.variants[0]?.originalPrice).toBeUndefined();
  });

  it("falls back to the thumbnail when there are no gallery images", () => {
    const detail = toProductDetail({
      id: "prod_1",
      handle: "keychain",
      title: "Keychain",
      thumbnail: "https://example.com/thumb.png",
      images: [],
      variants: [],
    });

    expect(detail.images).toEqual([
      { url: "https://example.com/thumb.png", alt: "Keychain" },
    ]);
  });

  it("detects a sale and carries the original price", () => {
    const detail = toProductDetail({
      id: "prod_1",
      handle: "keychain",
      title: "Keychain",
      variants: [
        {
          id: "var_1",
          title: null,
          calculated_price: {
            calculated_amount: 9,
            original_amount: 12,
            currency_code: "usd",
          },
        },
      ],
    });

    expect(detail.variants[0]?.price).toBe("$9.00");
    expect(detail.variants[0]?.originalPrice).toBe("$12.00");
    expect(detail.variants[0]?.savingsLabel).toBe("Save 25%");
  });

  it("has no savings label when not on sale", () => {
    const detail = toProductDetail({
      id: "prod_1",
      handle: "keychain",
      title: "Keychain",
      variants: [
        {
          id: "var_1",
          title: null,
          calculated_price: {
            calculated_amount: 9,
            original_amount: 9,
            currency_code: "usd",
          },
        },
      ],
    });

    expect(detail.variants[0]?.savingsLabel).toBeUndefined();
  });

  it("leaves price blank when there is no calculated price (no region resolved)", () => {
    const detail = toProductDetail({
      id: "prod_1",
      handle: "keychain",
      title: "Keychain",
      variants: [{ id: "var_1", title: null, calculated_price: null }],
    });

    expect(detail.variants[0]?.price).toBe("");
    expect(detail.variants[0]?.originalPrice).toBeUndefined();
  });

  it("carries variant availability through from the raw inventory fields", () => {
    const detail = toProductDetail({
      id: "prod_1",
      handle: "keychain",
      title: "Keychain",
      variants: [
        {
          id: "var_1",
          title: null,
          manage_inventory: true,
          inventory_quantity: 0,
        },
      ],
    });

    expect(detail.variants[0]?.availability).toBe("out_of_stock");
  });

  it("maps option values with their ids, for the selector to key off", () => {
    const detail = toProductDetail({
      id: "prod_1",
      handle: "keychain",
      title: "Keychain",
      options: [
        {
          id: "opt_color",
          title: "Color",
          values: [
            { id: "val_blush", value: "Blush" },
            { id: "val_sage", value: "Sage" },
          ],
        },
      ],
      variants: [],
    });

    expect(detail.options).toEqual([
      {
        id: "opt_color",
        title: "Color",
        values: [
          { id: "val_blush", value: "Blush" },
          { id: "val_sage", value: "Sage" },
        ],
      },
    ]);
  });
});

describe("fetchProductByHandle", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  function mockSdk() {
    return jest.requireMock<{
      sdk: { store: { product: { list: jest.Mock } } };
    }>("../../src/lib/medusa").sdk;
  }

  it("maps the first matching product through toProductDetail", async () => {
    const sdk = mockSdk();
    sdk.store.product.list.mockResolvedValue({
      products: [
        {
          id: "prod_1",
          handle: "keychain",
          title: "Keychain",
          categories: [{ name: "Keychains", handle: "keychains" }],
          variants: [],
        },
      ],
      count: 1,
      offset: 0,
      limit: 1,
    });

    const detail = await fetchProductByHandle("keychain", "reg_us");

    expect(detail?.title).toBe("Keychain");
    expect(sdk.store.product.list).toHaveBeenCalledWith(
      expect.objectContaining({ handle: "keychain", region_id: "reg_us" }),
    );
  });

  it("returns null when no product matches the handle", async () => {
    const sdk = mockSdk();
    sdk.store.product.list.mockResolvedValue({
      products: [],
      count: 0,
      offset: 0,
      limit: 1,
    });

    expect(await fetchProductByHandle("missing", "reg_us")).toBeNull();
  });

  it("returns null and does not throw when the SDK rejects", async () => {
    const sdk = mockSdk();
    sdk.store.product.list.mockRejectedValue(new Error("backend is down"));
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await expect(
      fetchProductByHandle("keychain", "reg_us"),
    ).resolves.toBeNull();

    consoleError.mockRestore();
  });
});
