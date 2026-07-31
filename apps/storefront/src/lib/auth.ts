import { cookies } from "next/headers";
import { cache } from "react";

import { sdk } from "./medusa";

export const AUTH_COOKIE_NAME = "cnp_customer_token";

export const RETURN_TO_COOKIE_NAME = "cnp_auth_return_to";
const RETURN_TO_MAX_AGE_SECONDS = 5 * 60;

export type SessionCookieOptions = {
  httpOnly: boolean;
  sameSite: "lax";
  secure: boolean;
  path: string;
  maxAge?: number;
};

export function sessionCookieOptions(maxAge?: number): SessionCookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(maxAge !== undefined ? { maxAge } : {}),
  };
}

export function returnToCookieOptions(): SessionCookieOptions {
  return {
    ...sessionCookieOptions(RETURN_TO_MAX_AGE_SECONDS),
    path: "/auth",
  };
}

export type DecodedAuthToken = {
  actor_id?: string;
  user_metadata?: Record<string, unknown>;
  exp?: number;
};

export function decodeJwtPayload(token: string): DecodedAuthToken | null {
  const segments = token.split(".");
  if (segments.length !== 3) return null;

  try {
    const payload = segments[1]!.replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload.padEnd(
      payload.length + ((4 - (payload.length % 4)) % 4),
      "=",
    );
    const json = Buffer.from(padded, "base64").toString("utf-8");
    return JSON.parse(json) as DecodedAuthToken;
  } catch {
    return null;
  }
}

export function classifyAuthCallbackError(
  errorDescription: string | undefined,
): "unverified_email" | "cancelled" {
  if (errorDescription && /verify/i.test(errorDescription)) {
    return "unverified_email";
  }
  return "cancelled";
}

export function customerNameFromUserMetadata(
  userMetadata: Record<string, unknown> | undefined,
): { first_name?: string; last_name?: string } {
  const givenName = userMetadata?.given_name;
  const familyName = userMetadata?.family_name;

  return {
    ...(typeof givenName === "string" && givenName
      ? { first_name: givenName }
      : {}),
    ...(typeof familyName === "string" && familyName
      ? { last_name: familyName }
      : {}),
  };
}

export type AuthProvider = "email" | "google" | "unknown";

export function authProviderFromSub(sub: string | undefined): AuthProvider {
  if (!sub) return "unknown";
  if (sub.startsWith("google-oauth2|")) return "google";
  return "email";
}

export function authProviderFromUserMetadata(
  userMetadata: Record<string, unknown> | null | undefined,
): AuthProvider {
  const sub = userMetadata?.auth0_sub;
  return authProviderFromSub(typeof sub === "string" ? sub : undefined);
}

export type AuthedCustomer = {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  created_at?: string | null;
  metadata?: Record<string, unknown> | null;
  authProvider: AuthProvider;
};

export const getCustomer = cache(async (): Promise<AuthedCustomer | null> => {
  const store = await cookies();
  const token = store.get(AUTH_COOKIE_NAME)?.value;

  if (!token) return null;

  try {
    const { customer } = await sdk.store.customer.retrieve(
      { fields: "id,email,first_name,last_name,phone,created_at,metadata" },
      { Authorization: `Bearer ${token}` },
    );

    const decoded = decodeJwtPayload(token);

    return {
      id: customer.id,
      email: customer.email,
      first_name: customer.first_name,
      last_name: customer.last_name,
      phone: customer.phone,
      created_at: customer.created_at,
      metadata: customer.metadata,
      authProvider: authProviderFromUserMetadata(decoded?.user_metadata),
    };
  } catch (error) {
    console.error("Could not load the signed-in customer", error);
    return null;
  }
});
