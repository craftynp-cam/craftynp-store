export type UpstreamErrorDetail = {
  upstreamStatus: number | null;
  reason: string;
};

/**
 * `sdk.client.fetch` rejects with a FetchError carrying only the upstream
 * status and its body's `message` — the `error`/`reason` fields a Medusa route
 * responds with are discarded by `normalizeResponse` before any caller sees
 * them. Both checkout proxies forward what survives, because a bare
 * `{ error: "checkout_unavailable" }` cannot distinguish a rejected quote from
 * a misconfigured region from Medusa being down, and that ambiguity cost two
 * rounds of live debugging apiece. Carries no `medusa.ts` import, so route
 * handlers and tests can use it freely.
 */
export function describeUpstreamError(error: unknown): UpstreamErrorDetail {
  const upstreamStatus =
    error !== null &&
    typeof error === "object" &&
    "status" in error &&
    Number.isFinite(Number((error as { status: unknown }).status))
      ? Number((error as { status: unknown }).status)
      : null;

  return {
    upstreamStatus,
    reason: error instanceof Error ? error.message : String(error),
  };
}
