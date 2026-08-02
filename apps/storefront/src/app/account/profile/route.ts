import { NextResponse, type NextRequest } from "next/server";

import { AUTH_COOKIE_NAME } from "@/lib/auth";
import { sdk } from "@/lib/medusa";

type ProfilePayload = {
  firstName: string;
  lastName: string;
  phone?: string;
};

function isProfilePayload(value: unknown): value is ProfilePayload {
  if (typeof value !== "object" || value === null) return false;
  const body = value as Record<string, unknown>;
  return (
    typeof body.firstName === "string" && typeof body.lastName === "string"
  );
}

export async function PATCH(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: "not_signed_in" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (!isProfilePayload(body)) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const errors: Record<string, string> = {};
  if (body.firstName.trim().length === 0) {
    errors.firstName = "Enter your first name.";
  }
  if (body.lastName.trim().length === 0) {
    errors.lastName = "Enter your last name.";
  }

  if (Object.keys(errors).length > 0) {
    return NextResponse.json(
      { error: "invalid_profile", fields: errors },
      { status: 400 },
    );
  }

  try {
    await sdk.store.customer.update(
      {
        first_name: body.firstName,
        last_name: body.lastName,
        phone: body.phone || null,
      },
      undefined,
      { Authorization: `Bearer ${token}` },
    );
  } catch (error) {
    console.error("Could not update the customer's profile", error);
    return NextResponse.json({ error: "save_failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
