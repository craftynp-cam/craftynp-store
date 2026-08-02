import { timingSafeEqual } from "node:crypto";

import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import type { Logger } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

export const ORIGIN_BLOCKED_LOG_TAG = "[origin:blocked]";

export const ORIGIN_SECRET_HEADER = "x-cnp-origin-secret";

export type OriginGuardMode = "off" | "log" | "enforce";

/**
 * Anything that is not exactly "log" or "enforce" disables the guard, including
 * a typo. That is the safe direction: a mistyped mode leaves the app reachable
 * rather than refusing every request including the platform's healthcheck.
 */
export function guardMode(
  secret: string | undefined,
  mode: string | undefined,
): OriginGuardMode {
  if (!secret) return "off";
  return mode === "enforce" || mode === "log" ? mode : "off";
}

export function headerMatches(value: unknown, secret: string): boolean {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string") return false;

  const a = Buffer.from(raw);
  const b = Buffer.from(secret);
  // timingSafeEqual throws on a length mismatch, so the length check is not
  // just an optimisation. It leaks only the length, never the contents.
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Refuses traffic that did not arrive through Cloudflare.
 *
 * The platform publishes its own hostname alongside the real one, and that
 * hostname bypasses the proxy entirely. While it is reachable, `rateLimit()` in
 * ./rate-limit.ts can be defeated outright by forging `cf-connecting-ip` — the
 * header it trusts precisely because Cloudflare strips any client-supplied
 * copy. A Transform Rule on the API hostname sets the header checked here, and
 * Cloudflare *sets* rather than appends, so a caller cannot supply their own.
 *
 * The mode is a variable rather than a code path so the lockout story is a
 * dashboard change and not a redeploy: ship in "log", watch until the only hits
 * are direct probes of the platform hostname, then switch to "enforce".
 */
export function originGuard() {
  return (
    req: MedusaRequest,
    res: MedusaResponse,
    next: MedusaNextFunction,
  ) => {
    const secret = process.env.ORIGIN_SHARED_SECRET;
    const mode = guardMode(secret, process.env.ORIGIN_GUARD_MODE);

    if (mode === "off") return next();
    if (headerMatches(req.headers[ORIGIN_SECRET_HEADER], secret!)) {
      return next();
    }

    try {
      req.scope
        .resolve<Logger>(ContainerRegistrationKeys.LOGGER)
        .warn(`${ORIGIN_BLOCKED_LOG_TAG} ${req.method} ${req.path}`);
    } catch {
      // Never let the absence of a logger decide whether a request is served.
    }

    if (mode === "log") return next();

    return res.status(403).json({
      error: "forbidden",
      reason: "origin_not_permitted",
      message: "This API is only reachable through its public hostname.",
    });
  };
}
