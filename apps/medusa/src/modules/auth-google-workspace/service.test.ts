import type {
  AuthIdentityProviderService,
  Logger,
} from "@medusajs/framework/types";

import GoogleWorkspaceAuthProviderService from "./service";

const ADMIN_CALLBACK = "https://api.thecraftynp.com/app/login";
const DESIGN_CALLBACK = "https://thecraftynp.org/auth/design/callback";

const OPTIONS = {
  clientId: "client-id",
  clientSecret: "client-secret",
  callbackUrl: ADMIN_CALLBACK,
  allowedCallbackUrls: [DESIGN_CALLBACK],
  allowedDomain: "thecraftynp.org",
};

function buildService() {
  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
  const setState = jest.fn().mockResolvedValue(undefined);

  const service = new GoogleWorkspaceAuthProviderService(
    { logger: logger as unknown as Logger },
    OPTIONS,
  );
  const authIdentityProviderService = {
    setState,
  } as unknown as AuthIdentityProviderService;

  return { service, logger, setState, authIdentityProviderService };
}

describe("GoogleWorkspaceAuthProviderService.authenticate", () => {
  it("ignores an unlisted callback_url in both the stored state and the redirect_uri", async () => {
    const { service, logger, setState, authIdentityProviderService } =
      buildService();

    const result = await service.authenticate(
      { body: { callback_url: "https://evil.example/cb" } },
      authIdentityProviderService,
    );

    expect(setState).toHaveBeenCalledWith(expect.any(String), {
      callback_url: ADMIN_CALLBACK,
    });
    expect(new URL(result.location!).searchParams.get("redirect_uri")).toBe(
      ADMIN_CALLBACK,
    );
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it("honours a listed callback_url", async () => {
    const { service, logger, setState, authIdentityProviderService } =
      buildService();

    const result = await service.authenticate(
      { body: { callback_url: DESIGN_CALLBACK } },
      authIdentityProviderService,
    );

    expect(setState).toHaveBeenCalledWith(expect.any(String), {
      callback_url: DESIGN_CALLBACK,
    });
    expect(new URL(result.location!).searchParams.get("redirect_uri")).toBe(
      DESIGN_CALLBACK,
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("uses the configured callback without a warning when the admin sends none", async () => {
    const { service, logger, setState, authIdentityProviderService } =
      buildService();

    await service.authenticate({ body: {} }, authIdentityProviderService);

    expect(setState).toHaveBeenCalledWith(expect.any(String), {
      callback_url: ADMIN_CALLBACK,
    });
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
