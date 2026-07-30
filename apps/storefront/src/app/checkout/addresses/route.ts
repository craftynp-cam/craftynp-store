import { NextResponse, type NextRequest } from "next/server";

import { AUTH_COOKIE_NAME } from "@/lib/auth";
import { EMPTY_CHECKOUT_DRAFT, validateCheckoutDraft } from "@/lib/checkout";
import { sdk } from "@/lib/medusa";

type AddressPayload = {
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

  if (!isAddressPayload(body)) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const errors = validateCheckoutDraft({
    ...EMPTY_CHECKOUT_DRAFT,
    firstName: body.firstName,
    lastName: body.lastName,
    email: "placeholder@example.com",
    phone: body.phone ?? "0000000000",
    address1: body.address1,
    address2: body.address2 ?? "",
    city: body.city,
    state: body.state,
    postalCode: body.postalCode,
    countryCode: body.countryCode,
  });
  const addressErrors = { ...errors };
  delete addressErrors.email;
  delete addressErrors.phone;
  delete addressErrors.shippingRateId;

  if (Object.keys(addressErrors).length > 0) {
    return NextResponse.json(
      { error: "invalid_address", fields: addressErrors },
      { status: 400 },
    );
  }

  try {
    await sdk.store.customer.createAddress(
      {
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
      {},
      { Authorization: `Bearer ${token}` },
    );
  } catch (error) {
    console.error("Could not save the customer's address", error);
    return NextResponse.json({ error: "save_failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
