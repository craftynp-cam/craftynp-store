import { MedusaError } from "@medusajs/framework/utils";

import {
  buildAuthorizeUrl,
  mapUserInfoToIdentity,
  validateAuth0Options,
} from "./lib.js";

describe("validateAuth0Options", () => {
  it("passes when every required option is present", () => {
    expect(() =>
      validateAuth0Options({
        domain: "example.us.auth0.com",
        clientId: "client-id",
        clientSecret: "client-secret",
        callbackUrl: "http://localhost:8000/auth/callback",
      }),
    ).not.toThrow();
  });

  it.each(["domain", "clientId", "clientSecret", "callbackUrl"])(
    "throws MedusaError.Types.INVALID_DATA when %s is missing",
    (missingKey) => {
      const options: Record<string, unknown> = {
        domain: "example.us.auth0.com",
        clientId: "client-id",
        clientSecret: "client-secret",
        callbackUrl: "http://localhost:8000/auth/callback",
      };
      delete options[missingKey];

      expect(() => validateAuth0Options(options)).toThrow(MedusaError);

      try {
        validateAuth0Options(options);
      } catch (error) {
        expect((error as MedusaError).type).toBe(
          MedusaError.Types.INVALID_DATA,
        );
      }
    },
  );
});

describe("buildAuthorizeUrl", () => {
  const base = {
    domain: "example.us.auth0.com",
    clientId: "client-id",
    redirectUri: "http://localhost:8000/auth/callback",
    state: "the-state",
  };

  it("carries response_type, the three scopes, the state, and the redirect_uri", () => {
    const url = new URL(buildAuthorizeUrl(base));

    expect(url.origin + url.pathname).toBe(
      "https://example.us.auth0.com/authorize",
    );
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("client-id");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "http://localhost:8000/auth/callback",
    );
    expect(url.searchParams.get("scope")).toBe("openid profile email");
    expect(url.searchParams.get("state")).toBe("the-state");
  });

  it("omits connection and screen_hint when not supplied", () => {
    const url = new URL(buildAuthorizeUrl(base));

    expect(url.searchParams.has("connection")).toBe(false);
    expect(url.searchParams.has("screen_hint")).toBe(false);
  });

  it("includes connection and screen_hint only when supplied", () => {
    const url = new URL(
      buildAuthorizeUrl({
        ...base,
        connection: "google-oauth2",
        screenHint: "signup",
      }),
    );

    expect(url.searchParams.get("connection")).toBe("google-oauth2");
    expect(url.searchParams.get("screen_hint")).toBe("signup");
  });
});

describe("mapUserInfoToIdentity", () => {
  it("rejects an unverified email", () => {
    const result = mapUserInfoToIdentity({
      sub: "auth0|abc",
      email: "cam@example.com",
      email_verified: false,
    });

    expect(result.success).toBe(false);
  });

  it("rejects a userinfo response with no email at all", () => {
    const result = mapUserInfoToIdentity({ sub: "auth0|abc" });

    expect(result.success).toBe(false);
  });

  it("maps a verified email to a lowercased entity_id", () => {
    const result = mapUserInfoToIdentity({
      sub: "auth0|abc",
      email: "Cam@Example.com",
      email_verified: true,
      name: "Cam",
    });

    expect(result).toEqual({
      success: true,
      identity: {
        entity_id: "cam@example.com",
        user_metadata: {
          email: "Cam@Example.com",
          name: "Cam",
          given_name: undefined,
          family_name: undefined,
          picture: undefined,
        },
        provider_metadata: { auth0_sub: "auth0|abc" },
      },
    });
  });

  it("carries given_name and family_name into user_metadata", () => {
    const result = mapUserInfoToIdentity({
      sub: "google-oauth2|abc",
      email: "cam@example.com",
      email_verified: true,
      given_name: "Cam",
      family_name: "Slash",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.identity.user_metadata.given_name).toBe("Cam");
      expect(result.identity.user_metadata.family_name).toBe("Slash");
    }
  });

  it("maps two different subs with the same verified email to the same entity_id", () => {
    const database = mapUserInfoToIdentity({
      sub: "auth0|abc123",
      email: "cam@example.com",
      email_verified: true,
    });
    const google = mapUserInfoToIdentity({
      sub: "google-oauth2|xyz789",
      email: "cam@example.com",
      email_verified: true,
    });

    expect(database.success && google.success).toBe(true);
    expect(database.success && database.identity.entity_id).toBe(
      google.success && google.identity.entity_id,
    );
  });

  it("stores no access, refresh, or id token in provider_metadata", () => {
    const result = mapUserInfoToIdentity({
      sub: "auth0|abc",
      email: "cam@example.com",
      email_verified: true,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(Object.keys(result.identity.provider_metadata)).toEqual([
        "auth0_sub",
      ]);
    }
  });
});
