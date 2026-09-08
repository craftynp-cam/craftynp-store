import { NextResponse, type NextRequest } from "next/server";

import { returnToCookieOptions } from "@/lib/auth";
import { DESIGN_RETURN_TO_COOKIE_NAME } from "@/lib/design-session";
import { createAuthFlowSdk } from "@/lib/medusa";
import { sanitizeDesignReturnTo } from "@/lib/routes";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const returnTo = sanitizeDesignReturnTo(searchParams.get("return_to"));

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;

  const authSdk = createAuthFlowSdk();

  let result: Awaited<ReturnType<typeof authSdk.auth.login>>;
  try {
    result = await authSdk.auth.login("user", "google-workspace", {
      callback_url: `${siteUrl}/auth/design/callback`,
    });
  } catch (error) {
    console.error("Could not start the design Google Workspace sign-in", error);
    return new NextResponse("Could not reach the sign-in service.", {
      status: 502,
    });
  }

  if (typeof result !== "object" || !("location" in result)) {
    console.error("Google Workspace login did not return a redirect location");
    return new NextResponse("Could not reach the sign-in service.", {
      status: 502,
    });
  }

  const response = NextResponse.redirect(result.location);
  response.cookies.set(
    DESIGN_RETURN_TO_COOKIE_NAME,
    returnTo,
    returnToCookieOptions(),
  );
  return response;
}
