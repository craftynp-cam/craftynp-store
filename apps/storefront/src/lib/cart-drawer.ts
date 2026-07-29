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
