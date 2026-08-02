import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export type ShippingQuotePayload = {
  v: 1;
  rid: string;
  amt: number;
  cur: string;
  svc: string;
  car: string;
  cs: string;
  exp: number;
};

export type CartSignatureInput = {
  items: readonly { variantId: string; quantity: number }[];
  postalCode: string;
  countryCode: string;
};

function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(input: string): string | null {
  try {
    const padded = input.replace(/-/g, "+").replace(/_/g, "/");
    const padding =
      padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
    return Buffer.from(padded + padding, "base64").toString("utf8");
  } catch {
    return null;
  }
}

export function cartSignature(input: CartSignatureInput): string {
  const canonical = [...input.items]
    .map((item) => `${item.variantId}:${item.quantity}`)
    .sort()
    .join(",");

  const hash = createHash("sha256");
  hash.update(
    `${input.countryCode.toLowerCase()}|${input.postalCode}|${canonical}`,
  );
  return hash.digest("hex");
}

export function signShippingQuote(
  payload: Omit<ShippingQuotePayload, "v">,
  secret: string,
): string {
  const fullPayload: ShippingQuotePayload = { v: 1, ...payload };
  const json = base64UrlEncode(JSON.stringify(fullPayload));
  const signature = createHmac("sha256", secret)
    .update(json)
    .digest("base64url");
  return `${json}.${signature}`;
}

export type VerifyQuoteResult =
  | { valid: true; payload: ShippingQuotePayload }
  | {
      valid: false;
      reason: "malformed" | "bad_signature" | "expired" | "cart_mismatch";
    };

function isShippingQuotePayload(value: unknown): value is ShippingQuotePayload {
  if (value == null || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    record.v === 1 &&
    typeof record.rid === "string" &&
    typeof record.amt === "number" &&
    typeof record.cur === "string" &&
    typeof record.svc === "string" &&
    typeof record.car === "string" &&
    typeof record.cs === "string" &&
    typeof record.exp === "number"
  );
}

export function verifyShippingQuote(
  token: string,
  secret: string,
  expected: { cartSignature: string; nowMs?: number },
): VerifyQuoteResult {
  const parts = token.split(".");
  if (parts.length !== 2) return { valid: false, reason: "malformed" };

  const [json, signature] = parts;
  if (!json || !signature) return { valid: false, reason: "malformed" };

  const expectedSignature = createHmac("sha256", secret)
    .update(json)
    .digest("base64url");

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return { valid: false, reason: "bad_signature" };
  }

  const decoded = base64UrlDecode(json);
  if (decoded == null) return { valid: false, reason: "malformed" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(decoded);
  } catch {
    return { valid: false, reason: "malformed" };
  }

  if (!isShippingQuotePayload(parsed)) {
    return { valid: false, reason: "malformed" };
  }

  const nowMs = expected.nowMs ?? Date.now();
  if (nowMs > parsed.exp) return { valid: false, reason: "expired" };

  if (parsed.cs !== expected.cartSignature) {
    return { valid: false, reason: "cart_mismatch" };
  }

  return { valid: true, payload: parsed };
}
