import type {
  AuthIdentityProviderService,
  Logger,
} from "@medusajs/framework/types";

import { CALLBACK_URL_IGNORED_LOG_TAG } from "../../lib/callback-url";
import type { Auth0ProviderOptions } from "./lib";
import Auth0AuthProviderService from "./service";

const STOREFRONT_CALLBACK = "https://thecraftynp.org/auth/callback";
const LISTED_CALLBACK = "https://thecraftynp.com/auth/callback";

const CONFIGURED_ONLY: Auth0ProviderOptions = {
  domain: "example.us.auth0.com",
  clientId: "client-id",
  clientSecret: "client-secret",
  callbackUrl: STOREFRONT_CALLBACK,
};

const WITH_ALLOWLIST: Auth0ProviderOptions = {
  ...CONFIGURED_ONLY,
  allowedCallbackUrls: [LISTED_CALLBACK],
};

function buildService(options: Auth0ProviderOptions) {
  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
  const setState = jest.fn().mockResolvedValue(undefined);

  const service = new Auth0AuthProviderService(
    { logger: logger as unknown as Logger },
    options,
  );
  const authIdentityProviderService = {
    setState,
  } as unknown as AuthIdentityProviderService;

  return { service, logger, setState, authIdentityProviderService };
}

describe("Auth0AuthProviderService.authenticate", () => {
  it("ignores an unlisted callback_url in both the stored state and the redirect_uri", async () => {
    const { service, logger, setState, authIdentityProviderService } =
      buildService(WITH_ALLOWLIST);

    const result = await service.authenticate(
      { body: { callback_url: "https://evil.example/cb" } },
      authIdentityProviderService,
    );

    expect(setState).toHaveBeenCalledWith(expect.any(String), {
      callback_url: STOREFRONT_CALLBACK,
    });
    expect(new URL(result.location!).searchParams.get("redirect_uri")).toBe(
      STOREFRONT_CALLBACK,
    );
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(CALLBACK_URL_IGNORED_LOG_TAG),
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("provider=auth0"),
    );
  });

  it("honours a listed callback_url", async () => {
    const { service, logger, setState, authIdentityProviderService } =
      buildService(WITH_ALLOWLIST);

    const result = await service.authenticate(
      { body: { callback_url: LISTED_CALLBACK } },
      authIdentityProviderService,
    );

    expect(setState).toHaveBeenCalledWith(expect.any(String), {
      callback_url: LISTED_CALLBACK,
    });
    expect(new URL(result.location!).searchParams.get("redirect_uri")).toBe(
      LISTED_CALLBACK,
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("logs no warning for the storefront's configured callback when nothing is listed", async () => {
    const { service, logger, authIdentityProviderService } =
      buildService(CONFIGURED_ONLY);

    await service.authenticate(
      { body: { callback_url: STOREFRONT_CALLBACK } },
      authIdentityProviderService,
    );

    expect(logger.warn).not.toHaveBeenCalled();
  });
});
