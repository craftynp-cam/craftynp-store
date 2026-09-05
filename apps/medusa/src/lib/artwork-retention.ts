export const ARTWORK_PURGE_LOG_TAG = "[artwork:purge]";
export const ARTWORK_PURGE_FAILED_LOG_TAG = "[artwork:purge-failed]";
export const ARTWORK_PROMOTE_LOG_TAG = "[artwork:promote]";
export const ARTWORK_PROMOTE_FAILED_LOG_TAG = "[artwork:promote-failed]";

export const DEFAULT_RETENTION_DAYS = 30;
export const DEFAULT_FALLBACK_DAYS = 60;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type RetentionPolicy = {
  retentionDays: number;
  fallbackDays: number;
};

export type PurgeReason = "delivered" | "undelivered";

export type RetentionSubject = {
  uploadedAt: Date;
  deliveredAt: Date | null;
};

function nonNegativeInt(value: string | undefined, fallback: number): number {
  // A blank value must read as unset, not as Number("") === 0. Set-but-empty
  // is what a half-filled deployment looks like, and zero here means purge
  // everything on the next run.
  if (value == null || value.trim() === "") return fallback;

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

export function readRetentionPolicy(
  env: NodeJS.ProcessEnv = process.env,
): RetentionPolicy {
  return {
    retentionDays: nonNegativeInt(
      env.ARTWORK_RETENTION_DAYS,
      DEFAULT_RETENTION_DAYS,
    ),
    fallbackDays: nonNegativeInt(
      env.ARTWORK_RETENTION_FALLBACK_DAYS,
      DEFAULT_FALLBACK_DAYS,
    ),
  };
}

export function purgeReason(subject: RetentionSubject): PurgeReason {
  return subject.deliveredAt ? "delivered" : "undelivered";
}

export function purgeDueAt(
  subject: RetentionSubject,
  policy: RetentionPolicy,
): Date {
  return subject.deliveredAt
    ? new Date(
        subject.deliveredAt.getTime() + policy.retentionDays * MS_PER_DAY,
      )
    : new Date(subject.uploadedAt.getTime() + policy.fallbackDays * MS_PER_DAY);
}

export type PurgeCandidate = {
  id: string;
  storage_key: string | null;
  promoted_at: Date | null;
  purged_at: Date | null;
  uploaded_at: Date;
};

export function selectPurgeCandidates<T extends PurgeCandidate>(
  rows: readonly T[],
  deliveredAtByAsset: ReadonlyMap<string, Date | null>,
  now: Date,
  policy: RetentionPolicy,
): { row: T; reason: PurgeReason }[] {
  const due: { row: T; reason: PurgeReason }[] = [];

  for (const row of rows) {
    if (row.purged_at != null) continue;
    if (row.promoted_at == null || row.storage_key == null) continue;

    const subject: RetentionSubject = {
      uploadedAt: row.uploaded_at,
      deliveredAt: deliveredAtByAsset.get(row.id) ?? null,
    };

    if (purgeDueAt(subject, policy).getTime() > now.getTime()) continue;

    due.push({ row, reason: purgeReason(subject) });
  }

  return due;
}
