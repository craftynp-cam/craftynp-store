export type UpstreamErrorDetail = {
  upstreamStatus: number | null;
  reason: string;
};

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
