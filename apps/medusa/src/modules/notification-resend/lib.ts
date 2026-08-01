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

// `x-resend-daily-quota` is the number of emails *already sent* today, sent
// only to free-plan accounts — Resend has no header for the remaining count,
// so that has to be derived against our own known cap. Do not fall back to
// the `ratelimit-*` headers here: those govern API request throttling
// (requests per second), a genuinely different thing from the daily email
// cap, and pairing one's "remaining" with the other's "limit" produces two
// unrelated numbers that only look like a matched pair.
export function readQuotaHeaders(headers: Headers): ResendQuota {
  const raw = headers.get("x-resend-daily-quota");
  if (raw == null) return { usedToday: null };

  const parsed = Number(raw);
  return { usedToday: Number.isFinite(parsed) ? parsed : null };
}

export function isQuotaExceeded(status: number, body: string): boolean {
  return status === 429 && /daily[_ -]?quota/i.test(body);
}
