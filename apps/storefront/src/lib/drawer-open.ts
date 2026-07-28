/**
 * Tracks whether any drawer is currently open. A set of ids rather than a
 * boolean or count, so a drawer reporting the same state twice (e.g. a
 * re-render) never drifts the tally.
 */
const openDrawerIds = new Set<string>();

const listeners = new Set<() => void>();

export function readAnyDrawerOpen(): boolean {
  return openDrawerIds.size > 0;
}

export function subscribeToDrawers(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setDrawerOpen(id: string, isOpen: boolean): void {
  const wasOpen = readAnyDrawerOpen();
  if (isOpen) {
    openDrawerIds.add(id);
  } else {
    openDrawerIds.delete(id);
  }
  if (readAnyDrawerOpen() !== wasOpen) {
    for (const listener of listeners) listener();
  }
}
