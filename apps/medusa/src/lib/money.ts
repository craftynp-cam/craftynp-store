function toPrimitiveAmount(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function toAmount(value: unknown): number {
  const direct = toPrimitiveAmount(value);
  if (direct != null) return direct;

  if (value == null || typeof value !== "object") return 0;

  const record = value as Record<string, unknown> & { toJSON?: () => unknown };

  for (const candidate of [
    record.numeric_,
    record.numeric,
    record.value,
    typeof record.toJSON === "function" ? record.toJSON() : undefined,
  ]) {
    const parsed = toPrimitiveAmount(candidate);
    if (parsed != null) return parsed;
  }

  return 0;
}

export function toNullableAmount(value: unknown): number | null {
  if (value == null) return null;
  return toAmount(value);
}
