import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export type PriceQuotePayload = {
  v: 1;
  amt: number;
  cur: string;
  ps: string;
  exp: number;
};

export type PriceSignatureInput = {
  variantId: string;
  quantity: number;
  widthInches?: number | null;
  heightInches?: number | null;
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

export function priceSignature(input: PriceSignatureInput): string {
  const hash = createHash("sha256");
  hash.update(
    `${input.variantId}|${input.quantity}|${input.widthInches ?? ""}|${input.heightInches ?? ""}`,
  );
  return hash.digest("hex");
}

export function signPriceQuote(
  payload: Omit<PriceQuotePayload, "v">,
  secret: string,
): string {
  const fullPayload: PriceQuotePayload = { v: 1, ...payload };
  const json = base64UrlEncode(JSON.stringify(fullPayload));
  const signature = createHmac("sha256", secret)
    .update(json)
    .digest("base64url");
  return `${json}.${signature}`;
}

export type VerifyPriceQuoteResult =
  | { valid: true; payload: PriceQuotePayload }
  | {
      valid: false;
      reason: "malformed" | "bad_signature" | "expired" | "line_mismatch";
    };

function isPriceQuotePayload(value: unknown): value is PriceQuotePayload {
  if (value == null || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    record.v === 1 &&
    typeof record.amt === "number" &&
    typeof record.cur === "string" &&
    typeof record.ps === "string" &&
    typeof record.exp === "number"
  );
}

export function verifyPriceQuote(
  token: string,
  secret: string,
  expected: { priceSignature: string; nowMs?: number },
): VerifyPriceQuoteResult {
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

  if (!isPriceQuotePayload(parsed)) {
    return { valid: false, reason: "malformed" };
  }

  const nowMs = expected.nowMs ?? Date.now();
  if (nowMs > parsed.exp) return { valid: false, reason: "expired" };

  if (parsed.ps !== expected.priceSignature) {
    return { valid: false, reason: "line_mismatch" };
  }

  return { valid: true, payload: parsed };
}
