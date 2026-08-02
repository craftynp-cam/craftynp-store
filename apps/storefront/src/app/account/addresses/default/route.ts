import { NextResponse, type NextRequest } from "next/server";

import { AUTH_COOKIE_NAME } from "@/lib/auth";
import { sdk } from "@/lib/medusa";

type DefaultPayload = { id: string };

function isDefaultPayload(value: unknown): value is DefaultPayload {
  if (typeof value !== "object" || value === null) return false;
  return typeof (value as Record<string, unknown>).id === "string";
}

export async function POST(request: NextRequest) {
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

  if (!isDefaultPayload(body)) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    const { addresses } = await sdk.store.customer.listAddress(
      { limit: 20 },
      { Authorization: `Bearer ${token}` },
    );
    const previousDefault = addresses.find(
      (address) => address.is_default_shipping && address.id !== body.id,
    );

    await sdk.store.customer.updateAddress(
      body.id,
      { is_default_shipping: true },
      undefined,
      { Authorization: `Bearer ${token}` },
    );

    if (previousDefault) {
      await sdk.store.customer.updateAddress(
        previousDefault.id,
        { is_default_shipping: false },
        undefined,
        { Authorization: `Bearer ${token}` },
      );
    }
  } catch (error) {
    console.error("Could not set the customer's default address", error);
    return NextResponse.json({ error: "save_failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
