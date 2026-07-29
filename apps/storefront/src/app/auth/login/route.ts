import { NextResponse, type NextRequest } from "next/server";

import { returnToCookieOptions, RETURN_TO_COOKIE_NAME } from "@/lib/auth";
import { createAuthFlowSdk } from "@/lib/medusa";
import { sanitizeReturnTo, signInHref } from "@/lib/routes";

/**
 * Starts the customer sign-in flow. Both "Continue with email" and
 * "Continue with Google" on /sign-in point here, differing only in the
 * `connection` and `screen_hint` query params — Universal Login owns the
 * actual credential forms, this route only asks Medusa's Auth0 provider for
 * the URL to redirect to.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const returnTo = sanitizeReturnTo(searchParams.get("return_to"));
  const connection = searchParams.get("connection") ?? undefined;
  const screenHint = searchParams.get("screen_hint") ?? undefined;

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
  const callbackUrl = `${siteUrl}/auth/callback`;

  const authSdk = createAuthFlowSdk();

  let result: Awaited<ReturnType<typeof authSdk.auth.login>>;
  try {
    result = await authSdk.auth.login("customer", "auth0", {
      callback_url: callbackUrl,
      ...(connection ? { connection } : {}),
      ...(screenHint ? { screen_hint: screenHint } : {}),
    });
  } catch (error) {
    console.error("Could not start the Auth0 sign-in flow", error);
    return NextResponse.redirect(
      new URL(signInHref({ error: "auth_failed" }), request.url),
    );
  }

  if (typeof result !== "object" || !("location" in result)) {
    console.error("Auth0 login did not return a redirect location");
    return NextResponse.redirect(
      new URL(signInHref({ error: "auth_failed" }), request.url),
    );
  }

  const response = NextResponse.redirect(result.location);
  response.cookies.set(
    RETURN_TO_COOKIE_NAME,
    returnTo,
    returnToCookieOptions(),
  );
  return response;
}
