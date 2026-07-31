const MAX_DEPTH = 4;

/**
 * `String(error)` on anything Medusa's workflow engine rejects with tends to
 * produce `[object Object]` — it throws `errors[0].error`, which is not
 * reliably an `Error` instance by the time a route's catch sees it. That
 * string then reached both the server log and, through `message`, the
 * storefront, making a failed order placement completely opaque from either
 * end. This unwraps the shapes that actually turn up and falls back to JSON
 * rather than to `[object Object]`.
 */
export function describeError(error: unknown, depth = 0): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;

  if (depth < MAX_DEPTH) {
    if (Array.isArray(error)) {
      const parts = error.map((entry) => describeError(entry, depth + 1));
      if (parts.length > 0) return parts.join("; ");
    }

    if (error !== null && typeof error === "object") {
      const record = error as Record<string, unknown>;
      if (typeof record.message === "string" && record.message !== "") {
        return record.message;
      }
      if (record.error !== undefined) {
        return describeError(record.error, depth + 1);
      }
    }
  }

  if (error !== null && typeof error === "object") {
    try {
      return JSON.stringify(error);
    } catch {
      return Object.prototype.toString.call(error);
    }
  }

  return String(error);
}
