import {
  AUTH_COOKIE_NAME,
  authProviderFromSub,
  authProviderFromUserMetadata,
  classifyAuthCallbackError,
  customerNameFromUserMetadata,
  decodeJwtPayload,
  getCustomer,
  returnToCookieOptions,
  sessionCookieOptions,
} from "@/lib/auth";

jest.mock("next/headers", () => ({ cookies: jest.fn() }));
jest.mock("../../src/lib/medusa", () => ({
  sdk: { store: { customer: { retrieve: jest.fn() } } },
}));

function makeToken(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "none" })).toString(
    "base64url",
  );
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.signature`;
}

describe("decodeJwtPayload", () => {
  it("decodes a well-formed token's payload", () => {
    const token = makeToken({ actor_id: "cus_123", exp: 1234567890 });

    expect(decodeJwtPayload(token)).toEqual({
      actor_id: "cus_123",
      exp: 1234567890,
    });
  });

  it("returns null for a token with the wrong number of segments", () => {
    expect(decodeJwtPayload("not-a-jwt")).toBeNull();
    expect(decodeJwtPayload("a.b.c.d")).toBeNull();
  });

  it("returns null for a payload segment that isn't valid JSON", () => {
    const token = `header.${Buffer.from("not json").toString("base64url")}.sig`;

    expect(decodeJwtPayload(token)).toBeNull();
  });

  it("decodes a token whose actor_id is empty — the first-sign-in case", () => {
    const token = makeToken({
      actor_id: "",
      user_metadata: { email: "a@b.com" },
    });

    expect(decodeJwtPayload(token)?.actor_id).toBe("");
  });
});

describe("sessionCookieOptions", () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    Object.defineProperty(process.env, "NODE_ENV", {
      value: originalEnv,
      configurable: true,
    });
  });

  it("is httpOnly, sameSite lax, and site-wide", () => {
    const options = sessionCookieOptions();

    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
  });

  it("is secure only in production", () => {
    Object.defineProperty(process.env, "NODE_ENV", {
      value: "production",
      configurable: true,
    });
    expect(sessionCookieOptions().secure).toBe(true);

    Object.defineProperty(process.env, "NODE_ENV", {
      value: "test",
      configurable: true,
    });
    expect(sessionCookieOptions().secure).toBe(false);
  });

  it("carries the given maxAge", () => {
    expect(sessionCookieOptions(3600).maxAge).toBe(3600);
  });
});

describe("returnToCookieOptions", () => {
  it("is scoped to /auth with a short maxAge", () => {
    const options = returnToCookieOptions();

    expect(options.path).toBe("/auth");
    expect(options.maxAge).toBe(5 * 60);
  });
});

describe("classifyAuthCallbackError", () => {
  it("classifies Auth0's email-verification denial distinctly from a cancellation", () => {
    expect(
      classifyAuthCallbackError("Please verify your email before continuing."),
    ).toBe("unverified_email");
  });

  it("matches case-insensitively", () => {
    expect(classifyAuthCallbackError("VERIFY your email")).toBe(
      "unverified_email",
    );
  });

  it("falls back to cancelled for an actual cancellation or unrecognised description", () => {
    expect(
      classifyAuthCallbackError("User did not authorize the request"),
    ).toBe("cancelled");
  });

  it("falls back to cancelled when there is no description at all", () => {
    expect(classifyAuthCallbackError(undefined)).toBe("cancelled");
  });
});

describe("customerNameFromUserMetadata", () => {
  it("maps given_name and family_name to first_name and last_name", () => {
    expect(
      customerNameFromUserMetadata({
        given_name: "Cam",
        family_name: "Slash",
      }),
    ).toEqual({ first_name: "Cam", last_name: "Slash" });
  });

  it("omits a name field that is missing", () => {
    expect(customerNameFromUserMetadata({ given_name: "Cam" })).toEqual({
      first_name: "Cam",
    });
  });

  it("returns an empty object for undefined or empty user_metadata", () => {
    expect(customerNameFromUserMetadata(undefined)).toEqual({});
    expect(customerNameFromUserMetadata({})).toEqual({});
  });

  it("ignores non-string or empty-string values", () => {
    expect(
      customerNameFromUserMetadata({ given_name: "", family_name: 42 }),
    ).toEqual({});
  });
});

describe("authProviderFromSub", () => {
  it("classifies a Google sub", () => {
    expect(authProviderFromSub("google-oauth2|123456")).toBe("google");
  });

  it("classifies any other sub as email", () => {
    expect(authProviderFromSub("auth0|123456")).toBe("email");
  });

  it("falls back to unknown when there is no sub", () => {
    expect(authProviderFromSub(undefined)).toBe("unknown");
  });
});

describe("authProviderFromUserMetadata", () => {
  it("reads the sub out of user_metadata", () => {
    expect(
      authProviderFromUserMetadata({ auth0_sub: "google-oauth2|123456" }),
    ).toBe("google");
  });

  it("falls back to unknown for a JWT minted before auth0_sub was added", () => {
    expect(authProviderFromUserMetadata({ email: "a@b.com" })).toBe("unknown");
    expect(authProviderFromUserMetadata(undefined)).toBe("unknown");
    expect(authProviderFromUserMetadata(null)).toBe("unknown");
  });
});

describe("getCustomer", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it("returns null without calling the SDK when there is no cookie", async () => {
    const { cookies } = jest.requireMock<{ cookies: jest.Mock }>(
      "next/headers",
    );
    const get = jest.fn().mockReturnValue(undefined);
    cookies.mockResolvedValue({ get });

    const { sdk } = jest.requireMock<{
      sdk: { store: { customer: { retrieve: jest.Mock } } };
    }>("../../src/lib/medusa");

    expect(await getCustomer()).toBeNull();
    expect(sdk.store.customer.retrieve).not.toHaveBeenCalled();
  });

  it("returns the mapped customer for a valid session", async () => {
    const { cookies } = jest.requireMock<{ cookies: jest.Mock }>(
      "next/headers",
    );
    const get = jest
      .fn()
      .mockReturnValue({ name: AUTH_COOKIE_NAME, value: "token-abc" });
    cookies.mockResolvedValue({ get });

    const { sdk } = jest.requireMock<{
      sdk: { store: { customer: { retrieve: jest.Mock } } };
    }>("../../src/lib/medusa");
    sdk.store.customer.retrieve.mockResolvedValue({
      customer: {
        id: "cus_123",
        email: "cam@example.com",
        first_name: "Cam",
        last_name: null,
      },
    });

    await expect(getCustomer()).resolves.toEqual({
      id: "cus_123",
      email: "cam@example.com",
      first_name: "Cam",
      last_name: null,
      authProvider: "unknown",
    });
    expect(sdk.store.customer.retrieve).toHaveBeenCalledWith(
      expect.anything(),
      { Authorization: "Bearer token-abc" },
    );
  });

  it("returns null and does not throw when the SDK rejects", async () => {
    const { cookies } = jest.requireMock<{ cookies: jest.Mock }>(
      "next/headers",
    );
    const get = jest
      .fn()
      .mockReturnValue({ name: AUTH_COOKIE_NAME, value: "expired" });
    cookies.mockResolvedValue({ get });

    const { sdk } = jest.requireMock<{
      sdk: { store: { customer: { retrieve: jest.Mock } } };
    }>("../../src/lib/medusa");
    sdk.store.customer.retrieve.mockRejectedValue(new Error("401"));

    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await expect(getCustomer()).resolves.toBeNull();

    consoleError.mockRestore();
  });
});
