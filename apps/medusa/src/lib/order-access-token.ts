import { createHmac, timingSafeEqual } from "node:crypto";

export type OrderAccessPayload = {
  v: 1;
  oid: string;
  exp: number;
};

export const DEFAULT_ORDER_ACCESS_TTL_DAYS = 90;

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

export function orderAccessTtlMs(ttlDays?: number): number {
  const days =
    ttlDays != null && Number.isFinite(ttlDays) && ttlDays > 0
      ? ttlDays
      : DEFAULT_ORDER_ACCESS_TTL_DAYS;
  return days * 24 * 60 * 60 * 1000;
}

export class OrderAccessSecretMissingError extends Error {
  constructor() {
    super("ORDER_ACCESS_SECRET is not set");
    this.name = "OrderAccessSecretMissingError";
  }
}

export function signOrderAccessToken(
  payload: Omit<OrderAccessPayload, "v">,
  secret: string,
): string {
  // An empty HMAC key still produces a signature that verifies, so an unset
  // secret would silently let anyone forge a token for any order.
  if (!secret) throw new OrderAccessSecretMissingError();

  const fullPayload: OrderAccessPayload = { v: 1, ...payload };
  const json = base64UrlEncode(JSON.stringify(fullPayload));
  const signature = createHmac("sha256", secret)
    .update(json)
    .digest("base64url");
  return `${json}.${signature}`;
}

export type VerifyOrderAccessResult =
  | { valid: true; payload: OrderAccessPayload }
  | {
      valid: false;
      reason:
        | "not_configured"
        | "malformed"
        | "bad_signature"
        | "expired"
        | "order_mismatch";
    };

function isOrderAccessPayload(value: unknown): value is OrderAccessPayload {
  if (value == null || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    record.v === 1 &&
    typeof record.oid === "string" &&
    typeof record.exp === "number"
  );
}

export function verifyOrderAccessToken(
  token: string,
  secret: string,
  expected: { orderId: string; nowMs?: number },
): VerifyOrderAccessResult {
  // Fail closed. Verifying against an empty key would accept a token any
  // caller could have computed themselves.
  if (!secret) return { valid: false, reason: "not_configured" };

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

  if (!isOrderAccessPayload(parsed)) {
    return { valid: false, reason: "malformed" };
  }

  const nowMs = expected.nowMs ?? Date.now();
  if (nowMs > parsed.exp) return { valid: false, reason: "expired" };

  if (parsed.oid !== expected.orderId) {
    return { valid: false, reason: "order_mismatch" };
  }

  return { valid: true, payload: parsed };
}
