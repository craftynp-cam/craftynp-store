import { MedusaError } from "@medusajs/framework/utils";

export type GoogleWorkspaceProviderOptions = {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  allowedDomain: string;
};

export function validateGoogleWorkspaceOptions(
  options: Record<string, unknown>,
): void {
  const missing = (
    ["clientId", "clientSecret", "callbackUrl", "allowedDomain"] as const
  ).filter((key) => !options[key]);

  if (missing.length > 0) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Google Workspace auth provider requires the following options: ${missing.join(", ")}`,
    );
  }
}

export type GoogleWorkspaceAuthorizeParams = {
  clientId: string;
  redirectUri: string;
  state: string;
  allowedDomain: string;
};

export function buildAuthorizeUrl(
  params: GoogleWorkspaceAuthorizeParams,
): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");

  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", params.state);
  url.searchParams.set("hd", params.allowedDomain);
  url.searchParams.set("prompt", "select_account");

  return url.toString();
}

export type GoogleWorkspaceUserInfo = {
  sub: string;
  email?: string;
  email_verified?: boolean;
  hd?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
};

export type MappedGoogleWorkspaceIdentity = {
  entity_id: string;
  user_metadata: Record<string, unknown>;
  provider_metadata: Record<string, unknown>;
};

export type MapUserInfoResult =
  | { success: true; identity: MappedGoogleWorkspaceIdentity }
  | { success: false; error: string };

export function mapUserInfoToIdentity(
  userInfo: GoogleWorkspaceUserInfo,
  allowedDomain: string,
): MapUserInfoResult {
  if (!userInfo.email) {
    return {
      success: false,
      error: "Google did not return an email address for this account.",
    };
  }

  if (!userInfo.email_verified) {
    return {
      success: false,
      error: "Please verify your email address before signing in.",
    };
  }

  const email = userInfo.email.toLowerCase();
  const emailDomain = email.split("@")[1];

  // `hd` is Google's authoritative claim for the Workspace domain a verified
  // account belongs to. A personal Gmail account never sets it, and the `hd`
  // query param on the authorize URL is only a UI hint the user can bypass by
  // switching accounts at Google, so this check — not that param — is the
  // real gate.
  if (userInfo.hd !== allowedDomain || emailDomain !== allowedDomain) {
    return {
      success: false,
      error: `Sign-in is restricted to ${allowedDomain} Google Workspace accounts.`,
    };
  }

  return {
    success: true,
    identity: {
      entity_id: email,
      user_metadata: {
        email: userInfo.email,
        name: userInfo.name,
        given_name: userInfo.given_name,
        family_name: userInfo.family_name,
        picture: userInfo.picture,
      },
      provider_metadata: {
        google_sub: userInfo.sub,
        hd: userInfo.hd,
      },
    },
  };
}
