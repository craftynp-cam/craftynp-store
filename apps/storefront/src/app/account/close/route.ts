import { NextResponse, type NextRequest } from "next/server";

import { AUTH_COOKIE_NAME } from "@/lib/auth";
import { sdk } from "@/lib/medusa";

export async function DELETE(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: "not_signed_in" }, { status: 401 });
  }

  try {
    await sdk.client.fetch("/store/customers/me", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (error) {
    console.error("Could not close the customer's account", error);
    return NextResponse.json({ error: "close_failed" }, { status: 502 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(AUTH_COOKIE_NAME);
  return response;
}
