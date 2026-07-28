/**
 * Mirrors `(prefers-reduced-motion: reduce)` into a `useSyncExternalStore`
 * source, matching the rest of this app's client stores (see
 * `cart-drawer.ts`). jsdom has no `matchMedia`, so every read guards for its
 * absence and reports `false`.
 */
function getMediaQueryList(): MediaQueryList | null {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return null;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)");
}

export function readPrefersReducedMotion(): boolean {
  return getMediaQueryList()?.matches ?? false;
}

export function subscribeToReducedMotion(listener: () => void): () => void {
  const mediaQueryList = getMediaQueryList();
  if (!mediaQueryList) return () => {};
  mediaQueryList.addEventListener("change", listener);
  return () => {
    mediaQueryList.removeEventListener("change", listener);
  };
}
