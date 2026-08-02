import { FetchError } from "@medusajs/js-sdk";

/**
 * Tells a failure of the backend itself from a failure of one query.
 *
 * The SDK raises FetchError only for an HTTP response — a connection that never
 * completed (wrong host, DNS, refused, TLS, timeout) rejects with a plain
 * TypeError carrying no status, so "not a FetchError" is itself the strongest
 * signal. Of the responses that do arrive, 401 and 403 mean the publishable key
 * is wrong or missing, 404 on a core store route means the URL is not a Medusa,
 * and 5xx means the origin is broken. Everything else — a rejected filter, a
 * 422 — is about the request, and its caller should still degrade.
 *
 * Do not use this where a 401 is a legitimate answer. `getCustomer` sends a
 * bearer token, so a 401 there is an expired session, not a misconfiguration.
 */
export function isBackendFailure(error: unknown): boolean {
  if (!(error instanceof FetchError)) return true;
  if (error.status === undefined) return true;
  return (
    error.status === 401 ||
    error.status === 403 ||
    error.status === 404 ||
    error.status >= 500
  );
}

/**
 * Raised instead of degrading when the backend, rather than the query, is the
 * problem. It escapes the fetch helpers on purpose so app/error.tsx renders a
 * visible error — a misconfigured NEXT_PUBLIC_MEDUSA_BACKEND_URL otherwise
 * produces an empty catalogue and a 200, which is indistinguishable from a
 * store with nothing in it.
 *
 * This module is deliberately free of medusa.ts, which throws at module-eval
 * when the environment is unset (see AGENTS.md).
 */
export class MedusaUnavailableError extends Error {
  constructor(what: string, cause: unknown) {
    super(
      `Could not load ${what} from the store backend at ${process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL}.`,
      { cause },
    );
    this.name = "MedusaUnavailableError";
  }
}
