import { randomBytes } from "node:crypto";

import type {
  AuthenticationInput,
  AuthenticationResponse,
  AuthIdentityProviderService,
  Logger,
} from "@medusajs/framework/types";
import {
  AbstractAuthModuleProvider,
  MedusaError,
} from "@medusajs/framework/utils";

import {
  buildAuthorizeUrl,
  mapUserInfoToIdentity,
  validateAuth0Options,
  type Auth0ProviderOptions,
  type Auth0UserInfo,
} from "./lib";

type InjectedDependencies = {
  logger: Logger;
};

class Auth0AuthProviderService extends AbstractAuthModuleProvider {
  static override identifier = "auth0";
  static override DISPLAY_NAME = "Auth0";

  protected logger_: Logger;
  protected options_: Auth0ProviderOptions;

  constructor(...args: [InjectedDependencies, Auth0ProviderOptions]) {
    super(...(args as unknown as []));
    const [{ logger }, options] = args;
    this.logger_ = logger;
    this.options_ = options;
  }

  static override validateOptions(options: Record<string, unknown>): void {
    validateAuth0Options(options);
  }

  override async authenticate(
    data: AuthenticationInput,
    authIdentityProviderService: AuthIdentityProviderService,
  ): Promise<AuthenticationResponse> {
    const state = randomBytes(32).toString("hex");
    const callbackUrl = data.body?.callback_url ?? this.options_.callbackUrl;

    await authIdentityProviderService.setState(state, {
      callback_url: callbackUrl,
    });

    const location = buildAuthorizeUrl({
      domain: this.options_.domain,
      clientId: this.options_.clientId,
      redirectUri: callbackUrl,
      state,
      connection: data.body?.connection,
      screenHint: data.body?.screen_hint,
    });

    return { success: true, location };
  }

  override async validateCallback(
    data: AuthenticationInput,
    authIdentityProviderService: AuthIdentityProviderService,
  ): Promise<AuthenticationResponse> {
    const code = data.query?.code;
    const stateKey = data.query?.state;

    if (!code || !stateKey) {
      return { success: false, error: "Missing authorization code or state." };
    }

    const state = await authIdentityProviderService.getState(stateKey);

    if (!state) {
      return {
        success: false,
        error: "No state provided, or the session expired.",
      };
    }

    const redirectUri =
      (state.callback_url as string | undefined) ?? this.options_.callbackUrl;

    let accessToken: string;

    try {
      const tokenResponse = await fetch(
        `https://${this.options_.domain}/oauth/token`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            grant_type: "authorization_code",
            client_id: this.options_.clientId,
            client_secret: this.options_.clientSecret,
            code,
            redirect_uri: redirectUri,
          }),
        },
      );

      if (!tokenResponse.ok) {
        this.logger_.error(
          `Auth0 token exchange returned ${tokenResponse.status}`,
        );
        return { success: false, error: "Failed to authenticate with Auth0." };
      }

      ({ access_token: accessToken } = (await tokenResponse.json()) as {
        access_token: string;
      });
    } catch (error) {
      this.logger_.error(
        `Auth0 token exchange failed: ${(error as Error).message}`,
      );
      return { success: false, error: "Failed to authenticate with Auth0." };
    }

    let userInfo: Auth0UserInfo;

    try {
      const userInfoResponse = await fetch(
        `https://${this.options_.domain}/userinfo`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      if (!userInfoResponse.ok) {
        this.logger_.error(
          `Auth0 userinfo returned ${userInfoResponse.status}`,
        );
        return { success: false, error: "Failed to authenticate with Auth0." };
      }

      userInfo = (await userInfoResponse.json()) as Auth0UserInfo;
    } catch (error) {
      this.logger_.error(
        `Auth0 userinfo request failed: ${(error as Error).message}`,
      );
      return { success: false, error: "Failed to authenticate with Auth0." };
    }

    const mapped = mapUserInfoToIdentity(userInfo);

    if (!mapped.success) {
      return { success: false, error: mapped.error };
    }

    const { entity_id, user_metadata, provider_metadata } = mapped.identity;

    let authIdentity;

    try {
      authIdentity = await authIdentityProviderService.retrieve({ entity_id });
    } catch (error) {
      if ((error as MedusaError).type !== MedusaError.Types.NOT_FOUND) {
        throw error;
      }

      authIdentity = await authIdentityProviderService.create({
        entity_id,
        user_metadata,
        provider_metadata,
      });
    }

    return { success: true, authIdentity };
  }
}

export default Auth0AuthProviderService;
