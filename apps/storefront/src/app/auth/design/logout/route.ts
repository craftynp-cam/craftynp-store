import { NextResponse, type NextRequest } from "next/server";

import { DESIGN_COOKIE_NAME } from "@/lib/design-session";
import { designHref } from "@/lib/routes";

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL(designHref(), request.url), {
    status: 303,
  });
  response.cookies.delete(DESIGN_COOKIE_NAME);
  return response;
}
