import { NextResponse, type NextRequest } from "next/server";

import type { PriceQuoteResponse } from "@craftynp/types";

import { sdk } from "@/lib/medusa";

type PriceQuotePayload = {
  variantId: string;
  quantity: number;
  dimensions?: { widthInches: number; heightInches: number };
};

function isDimensions(
  value: unknown,
): value is { widthInches: number; heightInches: number } {
  if (typeof value !== "object" || value === null) return false;
  const dimensions = value as Record<string, unknown>;
  return (
    typeof dimensions.widthInches === "number" &&
    typeof dimensions.heightInches === "number"
  );
}

function isPriceQuotePayload(value: unknown): value is PriceQuotePayload {
  if (typeof value !== "object" || value === null) return false;
  const body = value as Record<string, unknown>;

  if (typeof body.variantId !== "string" || body.variantId === "") return false;
  if (typeof body.quantity !== "number" || !Number.isInteger(body.quantity)) {
    return false;
  }

  return body.dimensions === undefined || isDimensions(body.dimensions);
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (!isPriceQuotePayload(body)) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    const response = await sdk.client.fetch<PriceQuoteResponse>(
      "/store/price-quote",
      { method: "POST", body },
    );
    return NextResponse.json(response);
  } catch (error) {
    console.error("Could not price the configured line", error);
    return NextResponse.json({ error: "price_unavailable" }, { status: 502 });
  }
}
