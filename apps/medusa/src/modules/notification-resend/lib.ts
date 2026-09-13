export const RESEND_SEND_FAILED_LOG_TAG = "[email:send-failed]";
export const RESEND_QUOTA_LOG_TAG = "[email:quota]";
export const RESEND_QUOTA_LOW_LOG_TAG = "[email:quota-low]";

export const RESEND_API_URL = "https://api.resend.com/emails";

export const RESEND_FREE_TIER_DAILY_CAP = 100;

export type ResendOptions = {
  channels: string[];
  apiKey: string;
  from: string;
  replyTo?: string;
  timeoutMs: number;
  maxRetries: number;
  dailyQuotaAlertThreshold: number;
};

export class ResendConfigError extends Error {}

export class ResendSendError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ResendSendError";
  }
}

export class ResendQuotaExceededError extends ResendSendError {
  constructor(message: string) {
    super(message, 429);
    this.name = "ResendQuotaExceededError";
  }
}

export class ResendRejectedError extends ResendSendError {
  constructor(status: number, body: string) {
    super(
      `Resend rejected the send (${status}, will not retry): ${
        isIdempotencyPayloadMismatch(status, body)
          ? "this idempotency key was already used with a different payload: "
          : ""
      }${body}`,
      status,
    );
    this.name = "ResendRejectedError";
  }
}

const PERMANENT_REJECTION =
  /Resend rejected the send \((\d{3}), will not retry\)/;

export function permanentRejectionStatus(message: string): number | null {
  const status = PERMANENT_REJECTION.exec(message)?.[1];
  return status ? Number(status) : null;
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ResendConfigError(`${name} is required to send email via Resend`);
  }
  return value;
}

function toNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function validateResendOptions(options: unknown): ResendOptions {
  const record = (options ?? {}) as Record<string, unknown>;

  const channels = Array.isArray(record.channels)
    ? (record.channels as string[])
    : ["email"];

  return {
    channels,
    apiKey: requireString(record.apiKey, "RESEND_API_KEY"),
    from: requireString(record.from, "RESEND_FROM_EMAIL"),
    ...(typeof record.replyTo === "string" && record.replyTo
      ? { replyTo: record.replyTo }
      : {}),
    timeoutMs: toNumber(record.timeoutMs, 5000),
    maxRetries: toNumber(record.maxRetries, 2),
    dailyQuotaAlertThreshold: toNumber(record.dailyQuotaAlertThreshold, 20),
  };
}

export type ResendQuota = {
  usedToday: number | null;
};

export function readQuotaHeaders(headers: Headers): ResendQuota {
  const raw = headers.get("x-resend-daily-quota");
  if (raw == null) return { usedToday: null };

  const parsed = Number(raw);
  return { usedToday: Number.isFinite(parsed) ? parsed : null };
}

export function isQuotaExceeded(status: number, body: string): boolean {
  return status === 429 && /daily[_ -]?quota/i.test(body);
}

export function isConcurrentIdempotentRequest(
  status: number,
  body: string,
): boolean {
  return status === 409 && /concurrent_idempotent_requests/.test(body);
}

export function isIdempotencyPayloadMismatch(
  status: number,
  body: string,
): boolean {
  return status === 409 && /invalid_idempotent_request/.test(body);
}

export function isRetryableRejection(status: number, body: string): boolean {
  return (
    status >= 500 ||
    status === 429 ||
    isConcurrentIdempotentRequest(status, body)
  );
}
