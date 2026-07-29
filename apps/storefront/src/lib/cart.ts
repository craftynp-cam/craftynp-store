export type CartLineDetail = { label: string; value: string };

export type CartLine = {
  id: string;
  href: string;
  title: string;
  imageUrl?: string;
  imageAlt?: string;
  unitPrice: number;
  currencyCode: string;
  quantity: number;
  isCustomizable?: boolean;
  details?: readonly CartLineDetail[];
};

export type Cart = { lines: readonly CartLine[] };

export const CART_STORAGE_KEY = "craftynp-cart";

const EMPTY_CART: Cart = { lines: [] };

function isCartLine(value: unknown): value is CartLine {
  if (typeof value !== "object" || value === null) return false;
  const line = value as Record<string, unknown>;
  return (
    typeof line.id === "string" &&
    typeof line.href === "string" &&
    typeof line.title === "string" &&
    typeof line.unitPrice === "number" &&
    typeof line.currencyCode === "string" &&
    typeof line.quantity === "number"
  );
}

function parseCart(raw: string | null): Cart {
  if (raw == null) return EMPTY_CART;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !Array.isArray((parsed as { lines?: unknown }).lines)
    ) {
      return EMPTY_CART;
    }

    const lines = (parsed as { lines: unknown[] }).lines.filter(isCartLine);
    return lines.length > 0 ? { lines } : EMPTY_CART;
  } catch {
    return EMPTY_CART;
  }
}

let cachedCart: Cart | null = null;

function readCartFromStorage(): Cart {
  if (cachedCart != null) return cachedCart;

  try {
    cachedCart = parseCart(window.localStorage.getItem(CART_STORAGE_KEY));
  } catch {
    cachedCart = EMPTY_CART;
  }

  return cachedCart;
}

export function readCart(): Cart {
  return readCartFromStorage();
}

export function readServerCart(): Cart {
  return EMPTY_CART;
}

const listeners = new Set<() => void>();

export function subscribeToCart(listener: () => void): () => void {
  const onStorage = () => {
    cachedCart = null;
    listener();
  };

  listeners.add(listener);
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function writeCart(cart: Cart): void {
  cachedCart = cart.lines.length > 0 ? cart : EMPTY_CART;

  try {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cachedCart));
  } catch {}

  for (const listener of listeners) listener();
}

export function addCartLine(line: CartLine): void {
  const current = readCartFromStorage();
  const existing = current.lines.find((candidate) => candidate.id === line.id);

  const lines = existing
    ? current.lines.map((candidate) =>
        candidate.id === line.id
          ? { ...candidate, quantity: candidate.quantity + line.quantity }
          : candidate,
      )
    : [...current.lines, line];

  writeCart({ lines });
}

export function setCartLineQuantity(id: string, quantity: number): void {
  const current = readCartFromStorage();
  const clamped = Number.isFinite(quantity)
    ? Math.max(1, Math.trunc(quantity))
    : 1;

  writeCart({
    lines: current.lines.map((line) =>
      line.id === id ? { ...line, quantity: clamped } : line,
    ),
  });
}

export function removeCartLine(id: string): void {
  const current = readCartFromStorage();
  writeCart({ lines: current.lines.filter((line) => line.id !== id) });
}

export function clearCart(): void {
  writeCart(EMPTY_CART);
}

export function cartLineCount(cart: Cart): number {
  return cart.lines.reduce((total, line) => total + line.quantity, 0);
}

export function cartSubtotal(cart: Cart): {
  amount: number;
  currencyCode: string;
} {
  const currencyCode = cart.lines[0]?.currencyCode ?? "usd";
  const amount = cart.lines.reduce(
    (total, line) => total + line.unitPrice * line.quantity,
    0,
  );
  return { amount, currencyCode };
}
