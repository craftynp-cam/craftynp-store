import { NextResponse, type NextRequest } from "next/server";

import {
  AUTH_COOKIE_NAME,
  RETURN_TO_COOKIE_NAME,
  classifyAuthCallbackError,
  decodeJwtPayload,
  sessionCookieOptions,
} from "@/lib/auth";
import { createAuthFlowSdk, sdk } from "@/lib/medusa";
import { sanitizeReturnTo, signInHref } from "@/lib/routes";

function tokenMaxAge(token: string): number | undefined {
  const decoded = decodeJwtPayload(token);
  if (!decoded?.exp) return undefined;
  return Math.max(decoded.exp - Math.floor(Date.now() / 1000), 0);
}
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const query = Object.fromEntries(url.searchParams.entries());
  const returnTo = sanitizeReturnTo(
    request.cookies.get(RETURN_TO_COOKIE_NAME)?.value,
  );

  function failure(error: string) {
    const response = NextResponse.redirect(
      new URL(signInHref({ error }), request.url),
    );
    response.cookies.delete(RETURN_TO_COOKIE_NAME);
    return response;
  }

  if (query.error) {
    return failure(classifyAuthCallbackError(query.error_description));
  }

  const authSdk = createAuthFlowSdk();

  let token: string;
  try {
    const result = await authSdk.auth.callback("customer", "auth0", query);
    if (typeof result !== "string") {
      return failure("auth_failed");
    }
    token = result;
  } catch (error) {
    console.error("Auth0 callback validation failed", error);
    return failure("auth_failed");
  }

  const decoded = decodeJwtPayload(token);
  if (!decoded) {
    return failure("auth_failed");
  }

  if (!decoded.actor_id) {
    const email = decoded.user_metadata?.email;
    if (typeof email !== "string") {
      return failure("auth_failed");
    }

    try {
      await sdk.store.customer.create(
        { email },
        {},
        { Authorization: `Bearer ${token}` },
      );

      const refreshed = await authSdk.auth.refresh({
        Authorization: `Bearer ${token}`,
      });

      if (typeof refreshed !== "object" || !("token" in refreshed)) {
        return failure("auth_failed");
      }

      token = refreshed.token;
    } catch (error) {
      console.error("Could not create the customer after Auth0 sign-in", error);
      return failure("auth_failed");
    }
  }

  const response = NextResponse.redirect(new URL(returnTo, request.url));
  response.cookies.set(
    AUTH_COOKIE_NAME,
    token,
    sessionCookieOptions(tokenMaxAge(token)),
  );
  response.cookies.delete(RETURN_TO_COOKIE_NAME);
  return response;
}
