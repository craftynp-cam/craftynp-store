import { allowedCallbackUrl, parseCallbackUrlList } from "./callback-url";

describe("parseCallbackUrlList", () => {
  it("splits on commas, trims each entry and drops the empty ones", () => {
    expect(
      parseCallbackUrlList(
        " http://localhost:9000/app/login, ,http://localhost:8000/auth/design/callback ,",
      ),
    ).toEqual([
      "http://localhost:9000/app/login",
      "http://localhost:8000/auth/design/callback",
    ]);
  });

  it.each([undefined, "", " , "])("returns no entries for %p", (raw) => {
    expect(parseCallbackUrlList(raw)).toEqual([]);
  });
});

describe("allowedCallbackUrl", () => {
  const options = {
    callbackUrl: "https://api.thecraftynp.com/app/login",
    allowedCallbackUrls: ["https://thecraftynp.org/auth/design/callback"],
  };

  it("honours a listed callback_url", () => {
    expect(
      allowedCallbackUrl(
        "https://thecraftynp.org/auth/design/callback",
        options,
      ),
    ).toBe("https://thecraftynp.org/auth/design/callback");
  });

  it("accepts the configured callbackUrl when nothing is listed", () => {
    expect(
      allowedCallbackUrl("https://api.thecraftynp.com/app/login", {
        callbackUrl: "https://api.thecraftynp.com/app/login",
      }),
    ).toBe("https://api.thecraftynp.com/app/login");
  });

  it.each([
    ["an unlisted URL", "https://evil.example/cb"],
    ["a trailing slash", "https://thecraftynp.org/auth/design/callback/"],
    ["a different scheme", "http://thecraftynp.org/auth/design/callback"],
    [
      "a different host",
      "https://thecraftynp.org.evil.example/auth/design/callback",
    ],
    [
      "a listed URL with a query",
      "https://thecraftynp.org/auth/design/callback?x=1",
    ],
  ])("falls back to the configured callbackUrl for %s", (_, requested) => {
    expect(allowedCallbackUrl(requested, options)).toBe(
      "https://api.thecraftynp.com/app/login",
    );
  });

  it.each([
    ["no callback_url", undefined],
    ["null", null],
    ["a number", 42],
    [
      "an array holding a listed URL",
      ["https://thecraftynp.org/auth/design/callback"],
    ],
  ])("falls back to the configured callbackUrl for %s", (_, requested) => {
    expect(allowedCallbackUrl(requested, options)).toBe(
      "https://api.thecraftynp.com/app/login",
    );
  });
});
