import {
  accountHref,
  authLoginHref,
  authLogoutHref,
  categoryHref,
  productHref,
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

  it("falls back to /account for an absolute URL", () => {
    expect(sanitizeReturnTo("https://evil.example.com")).toBe("/account");
  });

  it("falls back to /account for null or undefined", () => {
    expect(sanitizeReturnTo(null)).toBe("/account");
    expect(sanitizeReturnTo(undefined)).toBe("/account");
  });
});
