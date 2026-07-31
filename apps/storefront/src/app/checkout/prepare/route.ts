import { NextResponse, type NextRequest } from "next/server";

import type { CheckoutPrepareResponse } from "@craftynp/types";

import { sdk } from "@/lib/medusa";
import { describeUpstreamError } from "@/lib/upstream-error";

type CheckoutAddressPayload = {
  firstName: string;
  lastName: string;
  phone: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  postalCode: string;
  countryCode: string;
};

type CheckoutPreparePayload = {
  cartId?: string;
  email: string;
  shippingAddress: CheckoutAddressPayload;
  billingAddress: CheckoutAddressPayload;
  items: {
    variantId: string;
    quantity: number;
    isCustomizable?: boolean;
    details?: { label: string; value: string }[];
  }[];
  shippingRateId: string;
  shippingServiceCode: string;
  shippingQuoteToken: string;
  taxQuoteToken: string;
};

function isCheckoutAddressPayload(
  value: unknown,
): value is CheckoutAddressPayload {
  if (typeof value !== "object" || value === null) return false;
  const address = value as Record<string, unknown>;
  return (
    typeof address.firstName === "string" &&
    typeof address.lastName === "string" &&
    typeof address.phone === "string" &&
    typeof address.address1 === "string" &&
    typeof address.address2 === "string" &&
    typeof address.city === "string" &&
    typeof address.state === "string" &&
    typeof address.postalCode === "string" &&
    typeof address.countryCode === "string"
  );
}

function isCheckoutPreparePayload(
  value: unknown,
): value is CheckoutPreparePayload {
  if (typeof value !== "object" || value === null) return false;
  const body = value as Record<string, unknown>;

  if (body.cartId != null && typeof body.cartId !== "string") return false;
  if (typeof body.email !== "string") return false;
  if (!isCheckoutAddressPayload(body.shippingAddress)) return false;
  if (!isCheckoutAddressPayload(body.billingAddress)) return false;
  if (typeof body.shippingRateId !== "string") return false;
  if (typeof body.shippingServiceCode !== "string") return false;
  if (typeof body.shippingQuoteToken !== "string") return false;
  if (typeof body.taxQuoteToken !== "string") return false;

  if (!Array.isArray(body.items) || body.items.length === 0) return false;
  return body.items.every(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as Record<string, unknown>).variantId === "string" &&
      typeof (item as Record<string, unknown>).quantity === "number",
  );
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (!isCheckoutPreparePayload(body)) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    const response = await sdk.client.fetch<CheckoutPrepareResponse>(
      "/store/checkout/prepare-cart",
      { method: "POST", body },
    );
    return NextResponse.json(response);
  } catch (error) {
    const detail = describeUpstreamError(error);
    console.error(
      `Could not prepare checkout (upstream ${detail.upstreamStatus})`,
      error,
    );
    return NextResponse.json(
      { error: "checkout_unavailable", ...detail },
      { status: 502 },
    );
  }
}
