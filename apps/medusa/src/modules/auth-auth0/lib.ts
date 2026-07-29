import { MedusaError } from "@medusajs/framework/utils";

export type Auth0ProviderOptions = {
  domain: string;
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
};

export function validateAuth0Options(options: Record<string, unknown>): void {
  const missing = (
    ["domain", "clientId", "clientSecret", "callbackUrl"] as const
  ).filter((key) => !options[key]);

  if (missing.length > 0) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Auth0 auth provider requires the following options: ${missing.join(", ")}`,
    );
  }
}

export type Auth0AuthorizeParams = {
  domain: string;
  clientId: string;
  redirectUri: string;
  state: string;
  connection?: string;
  screenHint?: string;
};

export function buildAuthorizeUrl(params: Auth0AuthorizeParams): string {
  const url = new URL(`https://${params.domain}/authorize`);

  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("scope", "openid profile email");
  url.searchParams.set("state", params.state);

  if (params.connection) {
    url.searchParams.set("connection", params.connection);
  }

  if (params.screenHint) {
    url.searchParams.set("screen_hint", params.screenHint);
  }

  return url.toString();
}

export type Auth0UserInfo = {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

export type MappedAuth0Identity = {
  entity_id: string;
  user_metadata: Record<string, unknown>;
  provider_metadata: Record<string, unknown>;
};

export type MapUserInfoResult =
  | { success: true; identity: MappedAuth0Identity }
  | { success: false; error: string };

export function mapUserInfoToIdentity(
  userInfo: Auth0UserInfo,
): MapUserInfoResult {
  if (!userInfo.email) {
    return {
      success: false,
      error: "Auth0 did not return an email address for this account.",
    };
  }

  if (!userInfo.email_verified) {
    return {
      success: false,
      error: "Please verify your email address before signing in.",
    };
  }

  return {
    success: true,
    identity: {
      entity_id: userInfo.email.toLowerCase(),
      user_metadata: {
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
      },
      provider_metadata: {
        auth0_sub: userInfo.sub,
      },
    },
  };
}
