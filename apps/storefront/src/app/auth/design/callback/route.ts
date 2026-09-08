import { NextResponse, type NextRequest } from "next/server";

import { decodeJwtPayload, sessionCookieOptions } from "@/lib/auth";
import {
  DESIGN_COOKIE_NAME,
  DESIGN_RETURN_TO_COOKIE_NAME,
  DESIGN_SESSION_MAX_AGE_SECONDS,
  designAllowedDomain,
  designSessionSecret,
  isAllowedWorkspaceEmail,
  signDesignSession,
} from "@/lib/design-session";
import { createAuthFlowSdk } from "@/lib/medusa";
import { sanitizeDesignReturnTo } from "@/lib/routes";

function denied(message: string, status = 403) {
  const response = new NextResponse(message, { status });
  response.cookies.delete(DESIGN_RETURN_TO_COOKIE_NAME);
  return response;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const query = Object.fromEntries(url.searchParams.entries());
  const returnTo = sanitizeDesignReturnTo(
    request.cookies.get(DESIGN_RETURN_TO_COOKIE_NAME)?.value,
  );

  if (query.error) {
    return denied("Sign-in was cancelled or refused.");
  }

  const secret = designSessionSecret();
  if (!secret) {
    console.error("DESIGN_SESSION_SECRET is not set; refusing design access");
    return denied("The design gate is not configured.", 500);
  }

  const authSdk = createAuthFlowSdk();

  let token: string;
  try {
    const result = await authSdk.auth.callback(
      "user",
      "google-workspace",
      query,
    );
    if (typeof result !== "string") {
      return denied("Sign-in failed.");
    }
    token = result;
  } catch (error) {
    console.error("Google Workspace callback validation failed", error);
    return denied("Sign-in failed.");
  }

  const email = decodeJwtPayload(token)?.user_metadata?.email;

  if (typeof email !== "string") {
    return denied("Sign-in failed.");
  }

  if (!isAllowedWorkspaceEmail(email, designAllowedDomain())) {
    return denied("This account is outside the allowed Google Workspace.");
  }

  const expiresAt =
    Math.floor(Date.now() / 1000) + DESIGN_SESSION_MAX_AGE_SECONDS;

  const response = NextResponse.redirect(new URL(returnTo, request.url));
  response.cookies.set(
    DESIGN_COOKIE_NAME,
    signDesignSession(email, secret, expiresAt),
    sessionCookieOptions(DESIGN_SESSION_MAX_AGE_SECONDS),
  );
  response.cookies.delete(DESIGN_RETURN_TO_COOKIE_NAME);
  return response;
}
