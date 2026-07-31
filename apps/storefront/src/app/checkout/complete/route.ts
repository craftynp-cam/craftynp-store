import { NextResponse, type NextRequest } from "next/server";

import type { CheckoutCompleteResponse } from "@craftynp/types";

import { sdk } from "@/lib/medusa";
import { describeUpstreamError } from "@/lib/upstream-error";

type CheckoutCompletePayload = { cartId: string };

function isCheckoutCompletePayload(
  value: unknown,
): value is CheckoutCompletePayload {
  if (typeof value !== "object" || value === null) return false;
  const body = value as Record<string, unknown>;
  return typeof body.cartId === "string" && body.cartId !== "";
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (!isCheckoutCompletePayload(body)) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    const response = await sdk.client.fetch<CheckoutCompleteResponse>(
      "/store/checkout/complete",
      { method: "POST", body },
    );
    return NextResponse.json(response);
  } catch (error) {
    const detail = describeUpstreamError(error);
    console.error(
      `Could not complete checkout (upstream ${detail.upstreamStatus})`,
      error,
    );
    return NextResponse.json(
      { error: "order_placement_unavailable", ...detail },
      { status: 502 },
    );
  }
}
