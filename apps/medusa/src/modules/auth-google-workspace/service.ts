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
  validateGoogleWorkspaceOptions,
  type GoogleWorkspaceProviderOptions,
  type GoogleWorkspaceUserInfo,
} from "./lib";

type InjectedDependencies = {
  logger: Logger;
};

class GoogleWorkspaceAuthProviderService extends AbstractAuthModuleProvider {
  static override identifier = "google-workspace";
  static override DISPLAY_NAME = "Google Workspace";

  protected logger_: Logger;
  protected options_: GoogleWorkspaceProviderOptions;

  constructor(...args: [InjectedDependencies, GoogleWorkspaceProviderOptions]) {
    super(...(args as unknown as []));
    const [{ logger }, options] = args;
    this.logger_ = logger;
    this.options_ = options;
  }

  static override validateOptions(options: Record<string, unknown>): void {
    validateGoogleWorkspaceOptions(options);
  }

  override async register(): Promise<AuthenticationResponse> {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Google Workspace does not support registration. Use method `authenticate` instead.",
    );
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
      clientId: this.options_.clientId,
      redirectUri: callbackUrl,
      state,
      allowedDomain: this.options_.allowedDomain,
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
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "authorization_code",
          client_id: this.options_.clientId,
          client_secret: this.options_.clientSecret,
          code,
          redirect_uri: redirectUri,
        }),
      });

      if (!tokenResponse.ok) {
        this.logger_.error(
          `Google token exchange returned ${tokenResponse.status}`,
        );
        return {
          success: false,
          error: "Failed to authenticate with Google.",
        };
      }

      ({ access_token: accessToken } = (await tokenResponse.json()) as {
        access_token: string;
      });
    } catch (error) {
      this.logger_.error(
        `Google token exchange failed: ${(error as Error).message}`,
      );
      return { success: false, error: "Failed to authenticate with Google." };
    }

    let userInfo: GoogleWorkspaceUserInfo;

    try {
      const userInfoResponse = await fetch(
        "https://openidconnect.googleapis.com/v1/userinfo",
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      if (!userInfoResponse.ok) {
        this.logger_.error(
          `Google userinfo returned ${userInfoResponse.status}`,
        );
        return {
          success: false,
          error: "Failed to authenticate with Google.",
        };
      }

      userInfo = (await userInfoResponse.json()) as GoogleWorkspaceUserInfo;
    } catch (error) {
      this.logger_.error(
        `Google userinfo request failed: ${(error as Error).message}`,
      );
      return { success: false, error: "Failed to authenticate with Google." };
    }

    const mapped = mapUserInfoToIdentity(userInfo, this.options_.allowedDomain);

    if (!mapped.success) {
      return { success: false, error: mapped.error };
    }

    const { entity_id, user_metadata, provider_metadata } = mapped.identity;

    let authIdentity;

    try {
      authIdentity = await authIdentityProviderService.retrieve({ entity_id });
      await authIdentityProviderService.update(entity_id, {
        user_metadata,
        provider_metadata,
      });
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

export default GoogleWorkspaceAuthProviderService;
