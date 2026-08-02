import { FetchError } from "@medusajs/js-sdk";

import { MedusaUnavailableError } from "@/lib/medusa-error";

import { fetchSiteContent } from "@/lib/site-content";

jest.mock("../../src/lib/medusa", () => ({
  sdk: { client: { fetch: jest.fn() } },
}));

describe("fetchSiteContent", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it("returns the resolved site content from the store API", async () => {
    const { sdk } = jest.requireMock<{
      sdk: { client: { fetch: jest.Mock } };
    }>("../../src/lib/medusa");
    sdk.client.fetch.mockResolvedValue({
      site_content: { banner_enabled: true, banner_text: "Sale!" },
    });

    expect(await fetchSiteContent()).toEqual({
      banner_enabled: true,
      banner_text: "Sale!",
    });
  });

  it("requests the store route with a 60 second revalidate window", async () => {
    const { sdk } = jest.requireMock<{
      sdk: { client: { fetch: jest.Mock } };
    }>("../../src/lib/medusa");
    sdk.client.fetch.mockResolvedValue({
      site_content: { banner_enabled: false, banner_text: "" },
    });

    await fetchSiteContent();

    expect(sdk.client.fetch).toHaveBeenCalledWith(
      "/store/site-content",
      expect.objectContaining({ next: { revalidate: 60 } }),
    );
  });

  it("throws when the backend itself is unreachable", async () => {
    const { sdk } = jest.requireMock<{
      sdk: { client: { fetch: jest.Mock } };
    }>("../../src/lib/medusa");
    sdk.client.fetch.mockRejectedValue(new TypeError("fetch failed"));

    await expect(fetchSiteContent()).rejects.toThrow(MedusaUnavailableError);
  });

  it("returns the bar-off defaults and does not throw when the request itself is rejected", async () => {
    const { sdk } = jest.requireMock<{
      sdk: { client: { fetch: jest.Mock } };
    }>("../../src/lib/medusa");
    sdk.client.fetch.mockRejectedValue(
      new FetchError("bad request", "Bad Request", 400),
    );
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await expect(fetchSiteContent()).resolves.toEqual(
      expect.objectContaining({ banner_enabled: false }),
    );

    consoleError.mockRestore();
  });
});
