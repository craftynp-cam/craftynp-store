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
  return a.length === b.length && timingSafeEqual(a, b);
}

export const ORIGIN_GUARD_EXEMPT_PATHS = ["/health"];

/**
 * req.path is relative to where the middleware is mounted, so it is "/" for
 * every request here and cannot be matched or usefully logged. originalUrl
 * keeps the path the client actually asked for.
 */
export function requestPath(req: Pick<MedusaRequest, "originalUrl" | "url">) {
  const url = req.originalUrl || req.url || "";
  const query = url.indexOf("?");
  return query === -1 ? url : url.slice(0, query);
}

export function originGuard() {
  return (
    req: MedusaRequest,
    res: MedusaResponse,
    next: MedusaNextFunction,
  ) => {
    const secret = process.env.ORIGIN_SHARED_SECRET;
    const mode = guardMode(secret, process.env.ORIGIN_GUARD_MODE);
    const path = requestPath(req);

    if (mode === "off") return next();
    // The platform's own healthcheck reaches the container directly, never
    // through the proxy, so it carries no header. Enforcing here fails the
    // healthcheck and the deploy never goes live. /health exposes nothing.
    if (ORIGIN_GUARD_EXEMPT_PATHS.includes(path)) return next();
    if (headerMatches(req.headers[ORIGIN_SECRET_HEADER], secret!)) {
      return next();
    }

    try {
      req.scope
        .resolve<Logger>(ContainerRegistrationKeys.LOGGER)
        .warn(`${ORIGIN_BLOCKED_LOG_TAG} ${req.method} ${path}`);
    } catch {}

    if (mode === "log") return next();

    return res.status(403).json({
      error: "forbidden",
      reason: "origin_not_permitted",
      message: "This API is only reachable through its public hostname.",
    });
  };
}
