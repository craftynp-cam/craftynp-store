import { NextResponse, type NextRequest } from "next/server";

import { AUTH_COOKIE_NAME } from "@/lib/auth";
import { siteUrl } from "@/lib/routes";

export async function POST(request: NextRequest) {
  const domain = process.env.AUTH0_DOMAIN;
  const clientId = process.env.AUTH0_CLIENT_ID;
  const origin = siteUrl(request.url);

  const response =
    domain && clientId
      ? NextResponse.redirect(
          `https://${domain}/v2/logout?${new URLSearchParams({
            client_id: clientId,
            returnTo: origin,
          }).toString()}`,
          303,
        )
      : NextResponse.redirect(new URL("/", origin), 303);

  response.cookies.delete(AUTH_COOKIE_NAME);
  return response;
}
