import Medusa from "@medusajs/js-sdk";

const backendUrl = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL;
const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY;

if (!backendUrl) {
  throw new Error("NEXT_PUBLIC_MEDUSA_BACKEND_URL is not set");
}

if (!publishableKey) {
  throw new Error("NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY is not set");
}

export const sdk = new Medusa({
  baseUrl: backendUrl,
  publishableKey,
  debug: process.env.NODE_ENV === "development",
});

/**
 * A fresh client for the three calls that carry authentication state —
 * `auth.login`, `auth.callback`, `auth.refresh` — so nothing lands in the
 * module-scope `sdk` singleton, which is shared across concurrent server
 * requests. `jwtTokenStorageMethod: "nostore"` stops the SDK from persisting
 * the returned token anywhere (there is no `localStorage` on the server
 * regardless); every caller here reads the token off the return value and
 * passes it on explicitly instead.
 *
 * Store calls made on behalf of an already-signed-in customer (creating or
 * retrieving the customer record) don't need a scoped client at all — pass
 * an `Authorization` header on the one call, on the singleton `sdk`, since
 * that only affects that single request.
 */
export function createAuthFlowSdk(): Medusa {
  return new Medusa({
    // Non-null: the guards above already threw if either were unset, but
    // that narrowing doesn't cross into this nested function's closure.
    baseUrl: backendUrl!,
    publishableKey: publishableKey!,
    debug: process.env.NODE_ENV === "development",
    auth: { type: "jwt", jwtTokenStorageMethod: "nostore" },
  });
}
