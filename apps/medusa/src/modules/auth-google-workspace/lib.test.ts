import { MedusaError } from "@medusajs/framework/utils";

import {
  buildAuthorizeUrl,
  mapUserInfoToIdentity,
  validateGoogleWorkspaceOptions,
} from "./lib.js";

describe("validateGoogleWorkspaceOptions", () => {
  it("passes when every required option is present", () => {
    expect(() =>
      validateGoogleWorkspaceOptions({
        clientId: "client-id",
        clientSecret: "client-secret",
        callbackUrl: "http://localhost:9000/app/login",
        allowedDomain: "thecraftynp.org",
      }),
    ).not.toThrow();
  });

  it.each(["clientId", "clientSecret", "callbackUrl", "allowedDomain"])(
    "throws MedusaError.Types.INVALID_DATA when %s is missing",
    (missingKey) => {
      const options: Record<string, unknown> = {
        clientId: "client-id",
        clientSecret: "client-secret",
        callbackUrl: "http://localhost:9000/app/login",
        allowedDomain: "thecraftynp.org",
      };
      delete options[missingKey];

      expect(() => validateGoogleWorkspaceOptions(options)).toThrow(
        MedusaError,
      );

      try {
        validateGoogleWorkspaceOptions(options);
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
    clientId: "client-id",
    redirectUri: "http://localhost:9000/app/login",
    state: "the-state",
    allowedDomain: "thecraftynp.org",
  };

  it("carries response_type, scope, state, redirect_uri, hd, and prompt", () => {
    const url = new URL(buildAuthorizeUrl(base));

    expect(url.origin + url.pathname).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("client-id");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "http://localhost:9000/app/login",
    );
    expect(url.searchParams.get("scope")).toBe("openid email profile");
    expect(url.searchParams.get("state")).toBe("the-state");
    expect(url.searchParams.get("hd")).toBe("thecraftynp.org");
    expect(url.searchParams.get("prompt")).toBe("select_account");
  });
});

describe("mapUserInfoToIdentity", () => {
  const allowedDomain = "thecraftynp.org";

  it("rejects an unverified email", () => {
    const result = mapUserInfoToIdentity(
      {
        sub: "google-1",
        email: "cam@thecraftynp.org",
        email_verified: false,
        hd: "thecraftynp.org",
      },
      allowedDomain,
    );

    expect(result.success).toBe(false);
  });

  it("rejects a userinfo response with no email at all", () => {
    const result = mapUserInfoToIdentity({ sub: "google-1" }, allowedDomain);

    expect(result.success).toBe(false);
  });

  it("rejects a personal Gmail account with no hd claim", () => {
    const result = mapUserInfoToIdentity(
      {
        sub: "google-1",
        email: "cam@gmail.com",
        email_verified: true,
      },
      allowedDomain,
    );

    expect(result.success).toBe(false);
  });

  it("rejects a verified account from a different Workspace domain", () => {
    const result = mapUserInfoToIdentity(
      {
        sub: "google-1",
        email: "cam@other-company.com",
        email_verified: true,
        hd: "other-company.com",
      },
      allowedDomain,
    );

    expect(result.success).toBe(false);
  });

  it("maps a verified in-domain email to a lowercased entity_id", () => {
    const result = mapUserInfoToIdentity(
      {
        sub: "google-1",
        email: "Cam@TheCraftyNP.org",
        email_verified: true,
        hd: "thecraftynp.org",
        name: "Cam",
      },
      allowedDomain,
    );

    expect(result).toEqual({
      success: true,
      identity: {
        entity_id: "cam@thecraftynp.org",
        user_metadata: {
          email: "Cam@TheCraftyNP.org",
          name: "Cam",
          given_name: undefined,
          family_name: undefined,
          picture: undefined,
        },
        provider_metadata: {
          google_sub: "google-1",
          hd: "thecraftynp.org",
        },
      },
    });
  });

  it("carries given_name and family_name into user_metadata", () => {
    const result = mapUserInfoToIdentity(
      {
        sub: "google-1",
        email: "cam@thecraftynp.org",
        email_verified: true,
        hd: "thecraftynp.org",
        given_name: "Cam",
        family_name: "Slash",
      },
      allowedDomain,
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.identity.user_metadata.given_name).toBe("Cam");
      expect(result.identity.user_metadata.family_name).toBe("Slash");
    }
  });

  it("stores no access, refresh, or id token in provider_metadata", () => {
    const result = mapUserInfoToIdentity(
      {
        sub: "google-1",
        email: "cam@thecraftynp.org",
        email_verified: true,
        hd: "thecraftynp.org",
      },
      allowedDomain,
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(Object.keys(result.identity.provider_metadata).sort()).toEqual(
        ["google_sub", "hd"].sort(),
      );
    }
  });
});
