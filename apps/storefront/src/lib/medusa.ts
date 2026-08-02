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

export function createAuthFlowSdk(): Medusa {
  return new Medusa({
    baseUrl: backendUrl!,
    publishableKey: publishableKey!,
    debug: process.env.NODE_ENV === "development",
    auth: { type: "jwt", jwtTokenStorageMethod: "nostore" },
  });
}
