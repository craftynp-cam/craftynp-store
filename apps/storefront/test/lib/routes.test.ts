import {
  accountAddressesHref,
  accountHref,
  authLoginHref,
  authLogoutHref,
  categoryHref,
  checkoutHref,
  productHref,
  sanitizeDesignReturnTo,
  sanitizeReturnTo,
  signInHref,
} from "@/lib/routes";

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

describe("accountHref", () => {
  it("points at /account", () => {
    expect(accountHref()).toBe("/account");
  });
});

describe("accountAddressesHref", () => {
  it("points at /account/addresses", () => {
    expect(accountAddressesHref()).toBe("/account/addresses");
  });
});

describe("checkoutHref", () => {
  it("points at /checkout", () => {
    expect(checkoutHref()).toBe("/checkout");
  });
});

describe("signInHref", () => {
  it("returns the bare path with no options", () => {
    expect(signInHref()).toBe("/sign-in");
  });

  it("carries return_to and error as query params", () => {
    expect(signInHref({ returnTo: "/account", error: "cancelled" })).toBe(
      "/sign-in?return_to=%2Faccount&error=cancelled",
    );
  });
});

describe("authLoginHref", () => {
  it("returns the bare path with no options", () => {
    expect(authLoginHref()).toBe("/auth/login");
  });

  it("carries return_to, connection, and screen_hint as query params", () => {
    const href = authLoginHref({
      returnTo: "/account",
      connection: "google-oauth2",
      screenHint: "signup",
    });

    expect(href).toBe(
      "/auth/login?return_to=%2Faccount&connection=google-oauth2&screen_hint=signup",
    );
  });
});

describe("authLogoutHref", () => {
  it("points at /auth/logout", () => {
    expect(authLogoutHref()).toBe("/auth/logout");
  });
});

describe("sanitizeReturnTo", () => {
  it("passes through a same-site path", () => {
    expect(sanitizeReturnTo("/checkout")).toBe("/checkout");
  });

  it("falls back to /account for a protocol-relative URL", () => {
    expect(sanitizeReturnTo("//evil.example.com")).toBe("/account");
  });

  it("falls back to /account for a backslash protocol-relative URL", () => {
    expect(sanitizeReturnTo("/\\evil.example.com")).toBe("/account");
    expect(sanitizeReturnTo("/\\/evil.example.com")).toBe("/account");
  });

  it("falls back to /account for an absolute URL", () => {
    expect(sanitizeReturnTo("https://evil.example.com")).toBe("/account");
  });

  it("falls back to /account for null or undefined", () => {
    expect(sanitizeReturnTo(null)).toBe("/account");
    expect(sanitizeReturnTo(undefined)).toBe("/account");
  });
});

describe("sanitizeDesignReturnTo", () => {
  it("keeps a path inside the design section", () => {
    expect(sanitizeDesignReturnTo("/design/primitives")).toBe(
      "/design/primitives",
    );
  });

  it("falls back to /design/tokens for a path outside the design section", () => {
    expect(sanitizeDesignReturnTo("/account")).toBe("/design/tokens");
    expect(sanitizeDesignReturnTo("/designer/secret")).toBe("/design/tokens");
  });

  it("falls back to /design/tokens for a traversal out of the section", () => {
    expect(sanitizeDesignReturnTo("/design/../account")).toBe("/design/tokens");
  });

  it("falls back to /design/tokens for an absolute or protocol-relative URL", () => {
    expect(sanitizeDesignReturnTo("https://evil.example.com")).toBe(
      "/design/tokens",
    );
    expect(sanitizeDesignReturnTo("//evil.example.com")).toBe("/design/tokens");
  });

  it("falls back to /design/tokens for null or undefined", () => {
    expect(sanitizeDesignReturnTo(null)).toBe("/design/tokens");
    expect(sanitizeDesignReturnTo(undefined)).toBe("/design/tokens");
  });
});
