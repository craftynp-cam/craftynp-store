export const CART_COUNT_STORAGE_KEY = "craftynp-cart-count";

/**
 * A localStorage-backed stand-in for the real cart (CNP-47). It exists so the
 * header's cart badge is genuinely live now, per CNP-24 AC 2, rather than
 * hard-coded to zero. CNP-45 calls `setCartCount` after add-to-cart; CNP-47
 * replaces this backing with the actual Medusa cart. Keeping the public
 * surface to these three functions is what makes that swap a one-file change.
 */
export function readCartCount(): number {
  try {
    const stored = window.localStorage.getItem(CART_COUNT_STORAGE_KEY);
    const parsed = stored == null ? 0 : Number.parseInt(stored, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    // Safari in private mode throws on localStorage access.
    return 0;
  }
}

const listeners = new Set<() => void>();

/**
 * Backs `useSyncExternalStore`, mirroring `subscribeToTheme` in
 * `src/lib/theme.ts`. The `storage` event keeps other tabs in step.
 */
export function subscribeToCartCount(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function setCartCount(next: number): void {
  const clamped = Number.isFinite(next) && next > 0 ? Math.trunc(next) : 0;

  try {
    window.localStorage.setItem(CART_COUNT_STORAGE_KEY, String(clamped));
  } catch {
    // Count is still notified for this page view.
  }

  for (const listener of listeners) listener();
}
