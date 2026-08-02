export type CachedTaxQuote = {
  taxAmount: number;
  currencyCode: string;
  quoteToken: string;
};

export const TAX_QUOTE_CACHE_KEY = "craftynp-tax-quote";

const CACHE_TTL_MS = 15 * 60 * 1000;
const MAX_ENTRIES = 5;

type CacheEntry = { quote: CachedTaxQuote; fetchedAt: number };
type CacheShape = Record<string, CacheEntry>;

function readCacheFromStorage(): CacheShape {
  try {
    const raw = window.sessionStorage.getItem(TAX_QUOTE_CACHE_KEY);
    if (raw == null) return {};

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};

    return parsed as CacheShape;
  } catch {
    return {};
  }
}

function writeCacheToStorage(cache: CacheShape): void {
  try {
    window.sessionStorage.setItem(TAX_QUOTE_CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

export function readCachedTaxQuote(key: string): CachedTaxQuote | null {
  const cache = readCacheFromStorage();
  const entry = cache[key];
  if (!entry) return null;

  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) return null;

  return entry.quote;
}

export function readServerCachedTaxQuote(): CachedTaxQuote | null {
  return null;
}

export function writeCachedTaxQuote(key: string, quote: CachedTaxQuote): void {
  const cache = readCacheFromStorage();
  delete cache[key];

  const keys = Object.keys(cache);
  while (keys.length >= MAX_ENTRIES) {
    const oldestKey = keys.shift();
    if (oldestKey == null) break;
    delete cache[oldestKey];
  }

  cache[key] = { quote, fetchedAt: Date.now() };
  writeCacheToStorage(cache);
}

export function clearTaxQuoteCache(): void {
  try {
    window.sessionStorage.removeItem(TAX_QUOTE_CACHE_KEY);
  } catch {}
}
