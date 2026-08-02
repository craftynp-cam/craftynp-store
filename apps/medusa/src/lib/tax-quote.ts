import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export type TaxQuotePayload = {
  v: 1;
  cid: string;
  amt: number;
  cur: string;
  ts: string;
  exp: number;
};

export type TaxSignatureInput = {
  items: readonly { variantId: string; quantity: number }[];
  postalCode: string;
  countryCode: string;
  state: string;
  city: string;
  shippingAmount: number;
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

export function taxSignature(input: TaxSignatureInput): string {
  const canonical = [...input.items]
    .map((item) => `${item.variantId}:${item.quantity}`)
    .sort()
    .join(",");

  const hash = createHash("sha256");
  hash.update(
    `${input.countryCode.toLowerCase()}|${input.postalCode}|${input.state.toLowerCase()}|${input.city.toLowerCase()}|${input.shippingAmount}|${canonical}`,
  );
  return hash.digest("hex");
}

export function signTaxQuote(
  payload: Omit<TaxQuotePayload, "v">,
  secret: string,
): string {
  const fullPayload: TaxQuotePayload = { v: 1, ...payload };
  const json = base64UrlEncode(JSON.stringify(fullPayload));
  const signature = createHmac("sha256", secret)
    .update(json)
    .digest("base64url");
  return `${json}.${signature}`;
}

export type VerifyTaxQuoteResult =
  | { valid: true; payload: TaxQuotePayload }
  | {
      valid: false;
      reason: "malformed" | "bad_signature" | "expired" | "cart_mismatch";
    };

function isTaxQuotePayload(value: unknown): value is TaxQuotePayload {
  if (value == null || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    record.v === 1 &&
    typeof record.cid === "string" &&
    typeof record.amt === "number" &&
    typeof record.cur === "string" &&
    typeof record.ts === "string" &&
    typeof record.exp === "number"
  );
}

export function verifyTaxQuote(
  token: string,
  secret: string,
  expected: { taxSignature: string; nowMs?: number },
): VerifyTaxQuoteResult {
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

  if (!isTaxQuotePayload(parsed)) {
    return { valid: false, reason: "malformed" };
  }

  const nowMs = expected.nowMs ?? Date.now();
  if (nowMs > parsed.exp) return { valid: false, reason: "expired" };

  if (parsed.ts !== expected.taxSignature) {
    return { valid: false, reason: "cart_mismatch" };
  }

  return { valid: true, payload: parsed };
}
