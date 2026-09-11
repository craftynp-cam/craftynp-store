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
  minOrderQuantity?: number;
  isCustomizable?: boolean;
  details?: readonly CartLineDetail[];
  // What the backend quoted this line at, and the size it was quoted for.
  // Both travel to prepare-cart, which re-derives the price rather than
  // trusting either — the token only proves which line the quote was for.
  dimensions?: { widthInches: number; heightInches: number };
  priceQuoteToken?: string;
};

export type Cart = { lines: readonly CartLine[] };

export const CART_STORAGE_KEY = "craftynp-cart";

export function cartLineKey(line: CartLine): string {
  const configuration = (line.details ?? [])
    .map((detail) => `${detail.label}=${detail.value}`)
    .join("|");
  return configuration === "" ? line.id : `${line.id}#${configuration}`;
}

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

function allowedImageOrigins(): string[] {
  return [
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL,
    process.env.NEXT_PUBLIC_MEDIA_BASE_URL,
  ]
    .map((value) => {
      if (!value) return null;
      try {
        return new URL(value).origin;
      } catch {
        return null;
      }
    })
    .filter((origin) => origin != null);
}

export function renderableImageUrl(
  value: string | undefined,
): string | undefined {
  if (!value) return undefined;

  let origin: string;
  try {
    origin = new URL(value).origin;
  } catch {
    return value;
  }

  const allowed = allowedImageOrigins();
  if (allowed.length === 0) return value;
  return allowed.includes(origin) ? value : undefined;
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

    const lines = (parsed as { lines: unknown[] }).lines
      .filter(isCartLine)
      .map((line) => ({
        ...line,
        imageUrl: renderableImageUrl(line.imageUrl),
      }));
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
  const key = cartLineKey(line);
  const existing = current.lines.find(
    (candidate) => cartLineKey(candidate) === key,
  );

  const lines = existing
    ? current.lines.map((candidate) =>
        cartLineKey(candidate) === key
          ? { ...candidate, quantity: candidate.quantity + line.quantity }
          : candidate,
      )
    : [...current.lines, line];

  writeCart({ lines });
}

export function setCartLineQuantity(id: string, quantity: number): void {
  const current = readCartFromStorage();

  writeCart({
    lines: current.lines.map((line) => {
      if (cartLineKey(line) !== id) return line;

      const floor = line.minOrderQuantity ?? 1;
      const next = Number.isFinite(quantity)
        ? Math.max(floor, Math.trunc(quantity))
        : floor;

      if (next === line.quantity) return line;

      // The quote was issued for the old quantity, and a quantity break makes
      // that a different unit price. Dropping the token here is what makes
      // prepare-cart ask for a fresh one rather than charge a stale tier.
      const { priceQuoteToken: _staleQuote, ...rest } = line;
      return { ...rest, quantity: next };
    }),
  });
}

export function removeCartLine(id: string): void {
  const current = readCartFromStorage();
  writeCart({
    lines: current.lines.filter((line) => cartLineKey(line) !== id),
  });
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
