import { NextResponse, type NextRequest } from "next/server";

import type { TaxQuoteResponse } from "@craftynp/types";

import { sdk } from "@/lib/medusa";

type TaxQuotePayload = {
  destination: {
    countryCode: string;
    postalCode: string;
    city: string;
    state: string;
  };
  items: { variantId: string; quantity: number }[];
  shippingQuoteToken: string;
};

function isTaxQuotePayload(value: unknown): value is TaxQuotePayload {
  if (typeof value !== "object" || value === null) return false;
  const body = value as Record<string, unknown>;

  const destination = body.destination as Record<string, unknown> | undefined;
  if (
    !destination ||
    typeof destination.countryCode !== "string" ||
    typeof destination.postalCode !== "string" ||
    typeof destination.city !== "string" ||
    typeof destination.state !== "string"
  ) {
    return false;
  }

  if (typeof body.shippingQuoteToken !== "string" || body.shippingQuoteToken === "") {
    return false;
  }

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

  if (!isTaxQuotePayload(body)) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    const response = await sdk.client.fetch<TaxQuoteResponse>(
      "/store/tax-quote",
      { method: "POST", body },
    );
    return NextResponse.json(response);
  } catch (error) {
    console.error("Could not calculate tax", error);
    return NextResponse.json({ error: "tax_unavailable" }, { status: 502 });
  }
}
