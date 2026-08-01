import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import type { ICacheService, Logger } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

export const RATE_LIMITED_LOG_TAG = "[ratelimit:blocked]";

export type RateLimitRule = {
  name: string;
  limit: number;
  windowSeconds: number;
};

export function clientIp(
  headers: Record<string, unknown>,
  fallback: string,
): string {
  const first = (value: unknown): string | null => {
    const raw = Array.isArray(value) ? value[0] : value;
    if (typeof raw !== "string") return null;
    const trimmed = raw.split(",")[0]?.trim();
    return trimmed ? trimmed : null;
  };

  // Cloudflare sets cf-connecting-ip and strips any client-supplied copy of it,
  // so it is the only header here a caller cannot forge. x-forwarded-for is the
  // fallback for a non-Cloudflare proxy and is spoofable — see AGENTS.md.
  return (
    first(headers["cf-connecting-ip"]) ??
    first(headers["x-forwarded-for"]) ??
    fallback
  );
}

export function windowKey(
  rule: RateLimitRule,
  ip: string,
  nowMs: number,
): string {
  const window = Math.floor(nowMs / (rule.windowSeconds * 1000));
  return `ratelimit:${rule.name}:${ip}:${window}`;
}

export function retryAfterSeconds(rule: RateLimitRule, nowMs: number): number {
  const windowMs = rule.windowSeconds * 1000;
  return Math.ceil((windowMs - (nowMs % windowMs)) / 1000);
}

export function rateLimit(rule: RateLimitRule) {
  return async (
    req: MedusaRequest,
    res: MedusaResponse,
    next: MedusaNextFunction,
  ) => {
    let cache: ICacheService;
    try {
      cache = req.scope.resolve<ICacheService>(Modules.CACHE);
    } catch {
      // A missing cache must never take checkout down with it.
      return next();
    }

    const ip = clientIp(req.headers, req.socket?.remoteAddress ?? "unknown");
    const now = Date.now();
    const key = windowKey(rule, ip, now);

    let count: number;
    try {
      count = ((await cache.get<number>(key)) ?? 0) + 1;
      await cache.set(key, count, rule.windowSeconds);
    } catch {
      return next();
    }

    if (count > rule.limit) {
      const retryAfter = retryAfterSeconds(rule, now);
      req.scope
        .resolve<Logger>(ContainerRegistrationKeys.LOGGER)
        .warn(`${RATE_LIMITED_LOG_TAG} ${rule.name} ip=${ip} count=${count}`);
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({
        error: "rate_limited",
        reason: "too_many_requests",
        message: "Too many requests. Wait a moment and try again.",
      });
    }

    return next();
  };
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function ruleFromEnv(
  name: string,
  envKey: string,
  fallback: number,
): RateLimitRule {
  return {
    name,
    limit: positiveInt(process.env[envKey], fallback),
    windowSeconds: 60,
  };
}
