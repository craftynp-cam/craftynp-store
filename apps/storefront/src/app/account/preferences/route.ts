import { NextResponse, type NextRequest } from "next/server";

import { metadataFromPreferences } from "@/lib/account-preferences";
import { AUTH_COOKIE_NAME } from "@/lib/auth";
import { sdk } from "@/lib/medusa";

type PreferencesPayload = {
  newDrops: boolean;
  salesAndBundles: boolean;
};

function isPreferencesPayload(value: unknown): value is PreferencesPayload {
  if (typeof value !== "object" || value === null) return false;
  const body = value as Record<string, unknown>;
  return (
    typeof body.newDrops === "boolean" &&
    typeof body.salesAndBundles === "boolean"
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

  if (!isPreferencesPayload(body)) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    const { customer } = await sdk.store.customer.retrieve(
      { fields: "id,metadata" },
      { Authorization: `Bearer ${token}` },
    );

    await sdk.store.customer.update(
      {
        metadata: {
          ...customer.metadata,
          ...metadataFromPreferences(body),
        },
      },
      undefined,
      { Authorization: `Bearer ${token}` },
    );
  } catch (error) {
    console.error("Could not update the customer's preferences", error);
    return NextResponse.json({ error: "save_failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
