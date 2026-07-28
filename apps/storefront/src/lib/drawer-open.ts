/**
 * Tracks whether any drawer (nav or cart) is currently open, so the homepage
 * carousel (CNP-29 AC 5) can pause auto-advance while a drawer is up — the
 * drawers themselves have no reason to know about the carousel. A set of ids
 * rather than a boolean or count, so a drawer reporting the same state twice
 * (e.g. a re-render) never drifts the tally.
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
