import { createPublicKey, verify, type KeyObject } from "node:crypto";

export const SHIPSTATION_WEBHOOK_LOG_TAG = "[shipstation:webhook]";

export const SHIPSTATION_KEY_ID_HEADER = "x-shipengine-rsa-sha256-key-id";
export const SHIPSTATION_SIGNATURE_HEADER = "x-shipengine-rsa-sha256-signature";
export const SHIPSTATION_TIMESTAMP_HEADER = "x-shipengine-timestamp";

export type WebhookRejectionReason =
  | "not_configured"
  | "missing_headers"
  | "stale_timestamp"
  | "jwks_unavailable"
  | "unknown_key"
  | "bad_signature";

export class ShipStationWebhookError extends Error {
  reason: WebhookRejectionReason;

  constructor(reason: WebhookRejectionReason, message?: string) {
    super(message ?? reason);
    this.name = "ShipStationWebhookError";
    this.reason = reason;
  }
}

export type WebhookSignatureHeaders = {
  keyId?: string | string[] | undefined;
  signature?: string | string[] | undefined;
  timestamp?: string | string[] | undefined;
};

export type VerifyWebhookInput = {
  headers: WebhookSignatureHeaders;
  rawBody: string;
  jwksUrl: string | undefined;
  maxAgeSeconds: number;
  timeoutMs?: number;
  now?: number;
};

let cachedKeys: Map<string, KeyObject> | null = null;

export function __resetForTests(): void {
  cachedKeys = null;
}

export function signedPayload(timestamp: string, rawBody: string): string {
  return `${timestamp}.${rawBody}`;
}

function headerValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0]?.trim() || null;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function isTimestampFresh(
  timestamp: string,
  maxAgeSeconds: number,
  now: number,
): boolean {
  const asSeconds = Number(timestamp);
  const millis = Number.isFinite(asSeconds)
    ? asSeconds * 1000
    : Date.parse(timestamp);

  if (!Number.isFinite(millis)) return false;

  return Math.abs(now - millis) <= maxAgeSeconds * 1000;
}

function toKeyMap(payload: unknown): Map<string, KeyObject> {
  const keys = (payload as { keys?: unknown })?.keys;
  if (!Array.isArray(keys)) {
    throw new ShipStationWebhookError("jwks_unavailable", "JWKS has no keys");
  }

  const map = new Map<string, KeyObject>();

  for (const jwk of keys) {
    if (jwk == null || typeof jwk !== "object") continue;
    const kid = (jwk as { kid?: unknown }).kid;
    if (typeof kid !== "string" || !kid) continue;

    try {
      map.set(kid, createPublicKey({ key: jwk as never, format: "jwk" }));
    } catch {
      continue;
    }
  }

  return map;
}

async function loadJwks(
  jwksUrl: string,
  timeoutMs: number,
): Promise<Map<string, KeyObject>> {
  let response: Response;

  try {
    response = await fetch(jwksUrl, {
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw new ShipStationWebhookError(
      "jwks_unavailable",
      error instanceof Error ? error.message : String(error),
    );
  }

  if (!response.ok) {
    throw new ShipStationWebhookError(
      "jwks_unavailable",
      `JWKS responded ${response.status}`,
    );
  }

  return toKeyMap(await response.json());
}

export async function verifyShipStationWebhook(
  input: VerifyWebhookInput,
): Promise<void> {
  if (!input.jwksUrl) {
    throw new ShipStationWebhookError(
      "not_configured",
      "SHIPSTATION_JWKS_URL is not set",
    );
  }

  const keyId = headerValue(input.headers.keyId);
  const signature = headerValue(input.headers.signature);
  const timestamp = headerValue(input.headers.timestamp);

  if (!keyId || !signature || !timestamp) {
    throw new ShipStationWebhookError("missing_headers");
  }

  if (
    !isTimestampFresh(timestamp, input.maxAgeSeconds, input.now ?? Date.now())
  ) {
    throw new ShipStationWebhookError("stale_timestamp");
  }

  const timeoutMs = input.timeoutMs ?? 5000;

  cachedKeys ??= await loadJwks(input.jwksUrl, timeoutMs);

  if (!cachedKeys.has(keyId)) {
    cachedKeys = await loadJwks(input.jwksUrl, timeoutMs);
  }

  const key = cachedKeys.get(keyId);
  if (!key) {
    throw new ShipStationWebhookError("unknown_key");
  }

  const valid = verify(
    "RSA-SHA256",
    Buffer.from(signedPayload(timestamp, input.rawBody)),
    key,
    Buffer.from(signature, "base64"),
  );

  if (!valid) {
    throw new ShipStationWebhookError("bad_signature");
  }
}
