import { NextResponse, type NextRequest } from "next/server";

import { AUTH_COOKIE_NAME } from "@/lib/auth";
import { validateAddressFields } from "@/lib/checkout";
import { sdk } from "@/lib/medusa";

type AddressPayload = {
  addressName?: string;
  firstName: string;
  lastName: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  postalCode: string;
  countryCode: string;
  phone?: string;
};

function isAddressPayload(value: unknown): value is AddressPayload {
  if (typeof value !== "object" || value === null) return false;
  const body = value as Record<string, unknown>;
  return (
    typeof body.firstName === "string" &&
    typeof body.lastName === "string" &&
    typeof body.address1 === "string" &&
    typeof body.city === "string" &&
    typeof body.state === "string" &&
    typeof body.postalCode === "string" &&
    typeof body.countryCode === "string"
  );
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: "not_signed_in" }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (!isAddressPayload(body)) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const errors = validateAddressFields({
    firstName: body.firstName,
    lastName: body.lastName,
    address1: body.address1,
    city: body.city,
    state: body.state,
    postalCode: body.postalCode,
    countryCode: body.countryCode,
  });

  if (Object.keys(errors).length > 0) {
    return NextResponse.json(
      { error: "invalid_address", fields: errors },
      { status: 400 },
    );
  }

  try {
    await sdk.store.customer.updateAddress(
      id,
      {
        address_name: body.addressName || null,
        first_name: body.firstName,
        last_name: body.lastName,
        address_1: body.address1,
        address_2: body.address2 || null,
        city: body.city,
        province: body.state,
        postal_code: body.postalCode,
        country_code: body.countryCode,
        phone: body.phone || null,
      },
      undefined,
      { Authorization: `Bearer ${token}` },
    );
  } catch (error) {
    console.error("Could not update the customer's address", error);
    return NextResponse.json({ error: "save_failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: "not_signed_in" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await sdk.store.customer.deleteAddress(id, {
      Authorization: `Bearer ${token}`,
    });
  } catch (error) {
    console.error("Could not delete the customer's address", error);
    return NextResponse.json({ error: "delete_failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
