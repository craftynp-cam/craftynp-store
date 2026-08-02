import { NextResponse, type NextRequest } from "next/server";

import { AUTH_COOKIE_NAME, getCustomer } from "@/lib/auth";

const AUTH0_DB_CONNECTION = "Username-Password-Authentication";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: "not_signed_in" }, { status: 401 });
  }

  const customer = await getCustomer();
  if (!customer) {
    return NextResponse.json({ error: "not_signed_in" }, { status: 401 });
  }

  try {
    await fetch(
      `https://${process.env.AUTH0_DOMAIN}/dbconnections/change_password`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: process.env.AUTH0_CLIENT_ID,
          email: customer.email,
          connection: AUTH0_DB_CONNECTION,
        }),
      },
    );
  } catch (error) {
    console.error("Could not request an Auth0 password reset email", error);
  }

  return NextResponse.json({ ok: true });
}
