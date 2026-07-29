import { cache } from "react";
import { cookies } from "next/headers";

import { sdk } from "./medusa";

export const AUTH_COOKIE_NAME = "cnp_customer_token";

/**
 * Holds the post-sign-in destination between the storefront's own
 * `/auth/login` and `/auth/callback` routes. Kept separate from Medusa's
 * opaque OAuth `state` — the callback route has no way to read that back —
 * and short-lived, since it only needs to survive one redirect round trip.
 */
export const RETURN_TO_COOKIE_NAME = "cnp_auth_return_to";
const RETURN_TO_MAX_AGE_SECONDS = 5 * 60;

export type SessionCookieOptions = {
  httpOnly: boolean;
  sameSite: "lax";
  secure: boolean;
  path: string;
  maxAge?: number;
};

/**
 * `sameSite: "lax"`, not `"strict"` — a customer arriving at the callback
 * route via a top-level redirect from Auth0 (or clicking a link from any
 * external page) must still carry the cookie, or every sign-in looks
 * signed-out on the very page that's supposed to prove it worked.
 */
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

/**
 * The token comes from a trusted, server-to-server exchange with Medusa —
 * this only reads the payload, it does not verify the signature. Returns
 * `null` for anything malformed rather than throwing, so a bad or expired
 * token degrades to "signed out" instead of a 500.
 */
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

export type AuthedCustomer = {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
};

/**
 * Never throws — a Medusa outage or an expired/invalid cookie both degrade
 * to "signed out" rather than taking the page down, the same convention
 * `categories.ts`, `region.ts`, and `site-content.ts` already follow.
 */
export const getCustomer = cache(async (): Promise<AuthedCustomer | null> => {
  const store = await cookies();
  const token = store.get(AUTH_COOKIE_NAME)?.value;

  if (!token) return null;

  try {
    const { customer } = await sdk.store.customer.retrieve(
      { fields: "id,email,first_name,last_name" },
      { Authorization: `Bearer ${token}` },
    );

    return {
      id: customer.id,
      email: customer.email,
      first_name: customer.first_name,
      last_name: customer.last_name,
    };
  } catch (error) {
    console.error("Could not load the signed-in customer", error);
    return null;
  }
});
