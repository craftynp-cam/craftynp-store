import { NextResponse, type NextRequest } from "next/server";

import { AUTH_COOKIE_NAME } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const domain = process.env.AUTH0_DOMAIN;
  const clientId = process.env.AUTH0_CLIENT_ID;
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;

  const response =
    domain && clientId
      ? NextResponse.redirect(
          `https://${domain}/v2/logout?${new URLSearchParams({
            client_id: clientId,
            returnTo: siteUrl,
          }).toString()}`,
        )
      : NextResponse.redirect(new URL("/", request.url));

  response.cookies.delete(AUTH_COOKIE_NAME);
  return response;
}
