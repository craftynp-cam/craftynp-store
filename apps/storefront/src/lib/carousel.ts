/**
 * Pure wraparound index maths for the homepage category carousel (CNP-29
 * AC 3), split out so the wrap behaviour is provable without driving fake
 * timers.
 */
export function nextIndex(current: number, total: number): number {
  if (total <= 0) return 0;
  return (current + 1) % total;
}

export function previousIndex(current: number, total: number): number {
  if (total <= 0) return 0;
  return (current - 1 + total) % total;
}
