/**
 * Ephemeral, unpersisted open state for the cart drawer (CNP-47) — separate
 * from `cart.ts` because UI state and the cart's contents have different
 * lifetimes; a reload should never leave the drawer open. `openCartDrawer` is
 * the seam CNP-45 uses to open the drawer on a successful add-to-cart (AC 1),
 * without the drawer or its trigger reaching into `useOverlayState`, which
 * does not resolve under Jest (see apps/storefront/AGENTS.md).
 */
let isOpen = false;

const listeners = new Set<() => void>();

export function readCartDrawerOpen(): boolean {
  return isOpen;
}

export function subscribeToCartDrawer(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setCartDrawerOpen(next: boolean): void {
  if (next === isOpen) return;
  isOpen = next;
  for (const listener of listeners) listener();
}

export function openCartDrawer(): void {
  setCartDrawerOpen(true);
}
