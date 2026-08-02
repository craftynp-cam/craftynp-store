import { FetchError } from "@medusajs/js-sdk";

import { MedusaUnavailableError } from "@/lib/medusa-error";

import { fetchRegion, selectDefaultRegion } from "@/lib/region";

jest.mock("../../src/lib/medusa", () => ({
  sdk: { store: { region: { list: jest.fn() } } },
}));

describe("selectDefaultRegion", () => {
  it("returns null for an empty list", () => {
    expect(selectDefaultRegion([], "us")).toBeNull();
  });

  it("matches the region containing the default country code", () => {
    const regions = [
      { id: "reg_eu", countries: [{ iso_2: "de" }, { iso_2: "fr" }] },
      { id: "reg_us", countries: [{ iso_2: "us" }] },
    ];

    expect(selectDefaultRegion(regions, "us")?.id).toBe("reg_us");
  });

  it("matches case-insensitively", () => {
    const regions = [{ id: "reg_us", countries: [{ iso_2: "us" }] }];

    expect(selectDefaultRegion(regions, "US")?.id).toBe("reg_us");
  });

  it("falls back to the first region when no country matches", () => {
    const regions = [
      { id: "reg_eu", countries: [{ iso_2: "de" }] },
      { id: "reg_us", countries: [{ iso_2: "us" }] },
    ];

    expect(selectDefaultRegion(regions, "jp")?.id).toBe("reg_eu");
  });

  it("falls back to the first region when no default country code is given", () => {
    const regions = [{ id: "reg_eu", countries: [{ iso_2: "de" }] }];

    expect(selectDefaultRegion(regions, undefined)?.id).toBe("reg_eu");
  });
});

describe("fetchRegion", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it("returns the selected region on a successful response", async () => {
    const { sdk } = jest.requireMock<{
      sdk: { store: { region: { list: jest.Mock } } };
    }>("../../src/lib/medusa");
    sdk.store.region.list.mockResolvedValue({
      regions: [{ id: "reg_us", countries: [{ iso_2: "us" }] }],
      count: 1,
      offset: 0,
      limit: 100,
    });

    expect(await fetchRegion()).toEqual({
      id: "reg_us",
      countries: [{ iso_2: "us" }],
    });
  });

  it("passes country display names through unchanged", async () => {
    const { sdk } = jest.requireMock<{
      sdk: { store: { region: { list: jest.Mock } } };
    }>("../../src/lib/medusa");
    sdk.store.region.list.mockResolvedValue({
      regions: [
        {
          id: "reg_us",
          countries: [{ iso_2: "us", display_name: "United States" }],
        },
      ],
      count: 1,
      offset: 0,
      limit: 100,
    });

    expect(await fetchRegion()).toEqual({
      id: "reg_us",
      countries: [{ iso_2: "us", display_name: "United States" }],
    });
  });

  it("throws when the backend itself is unreachable", async () => {
    const { sdk } = jest.requireMock<{
      sdk: { store: { region: { list: jest.Mock } } };
    }>("../../src/lib/medusa");
    sdk.store.region.list.mockRejectedValue(new TypeError("fetch failed"));

    await expect(fetchRegion()).rejects.toThrow(MedusaUnavailableError);
  });

  it("returns null and does not throw when the request itself is rejected", async () => {
    const { sdk } = jest.requireMock<{
      sdk: { store: { region: { list: jest.Mock } } };
    }>("../../src/lib/medusa");
    sdk.store.region.list.mockRejectedValue(
      new FetchError("bad filter", "Bad Request", 400),
    );
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await expect(fetchRegion()).resolves.toBeNull();

    consoleError.mockRestore();
  });
});
