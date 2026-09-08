import { createHmac, timingSafeEqual } from "node:crypto";

export const DESIGN_COOKIE_NAME = "cnp_design_session";
export const DESIGN_RETURN_TO_COOKIE_NAME = "cnp_design_return_to";

export const DESIGN_SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

export type DesignSession = {
  email: string;
  exp: number;
};

function base64url(value: Buffer): string {
  return value.toString("base64url");
}

function sign(payload: string, secret: string): string {
  return base64url(createHmac("sha256", secret).update(payload).digest());
}

export function designSessionSecret(): string | undefined {
  const secret = process.env.DESIGN_SESSION_SECRET;
  return secret ? secret : undefined;
}

export function designAllowedDomain(): string | undefined {
  const domain = process.env.DESIGN_ALLOWED_DOMAIN;
  return domain ? domain.toLowerCase() : undefined;
}

export function isDesignGateEnabled(): boolean {
  const setting = process.env.DESIGN_GATE;
  if (setting === "on") return true;
  if (setting === "off") return false;
  return process.env.NODE_ENV === "production";
}

export function isAllowedWorkspaceEmail(
  email: string | undefined,
  domain: string | undefined,
): boolean {
  if (!email || !domain) return false;
  const parts = email.toLowerCase().split("@");
  if (parts.length !== 2) return false;
  return parts[1] === domain.toLowerCase();
}

export function signDesignSession(
  email: string,
  secret: string,
  expiresAt: number,
): string {
  const payload = base64url(
    Buffer.from(JSON.stringify({ email, exp: expiresAt }), "utf-8"),
  );
  return `${payload}.${sign(payload, secret)}`;
}

export function verifyDesignSession(
  value: string | undefined,
  secret: string | undefined,
  now: number = Math.floor(Date.now() / 1000),
): DesignSession | null {
  if (!value || !secret) return null;

  const segments = value.split(".");
  if (segments.length !== 2) return null;

  const [payload, signature] = segments;
  if (!payload || !signature) return null;

  const expected = Buffer.from(sign(payload, secret), "utf-8");
  const received = Buffer.from(signature, "utf-8");
  if (expected.length !== received.length) return null;
  if (!timingSafeEqual(expected, received)) return null;

  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
  } catch {
    return null;
  }

  if (typeof decoded !== "object" || decoded === null) return null;

  const { email, exp } = decoded as Record<string, unknown>;
  if (typeof email !== "string" || !email) return null;
  if (typeof exp !== "number" || !Number.isFinite(exp)) return null;
  if (exp <= now) return null;

  return { email, exp };
}
