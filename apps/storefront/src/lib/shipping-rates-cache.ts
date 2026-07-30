import type { ShippingRate } from "@craftynp/types";

export const SHIPPING_RATES_CACHE_KEY = "craftynp-shipping-rates";

const CACHE_TTL_MS = 15 * 60 * 1000;
const MAX_ENTRIES = 5;

type CacheEntry = { rates: ShippingRate[]; fetchedAt: number };
type CacheShape = Record<string, CacheEntry>;

function readCacheFromStorage(): CacheShape {
  try {
    const raw = window.sessionStorage.getItem(SHIPPING_RATES_CACHE_KEY);
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
    window.sessionStorage.setItem(
      SHIPPING_RATES_CACHE_KEY,
      JSON.stringify(cache),
    );
  } catch {}
}

export function readCachedShippingRates(
  key: string,
): readonly ShippingRate[] | null {
  const cache = readCacheFromStorage();
  const entry = cache[key];
  if (!entry) return null;

  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) return null;

  return entry.rates;
}

export function readServerCachedShippingRates():
  readonly ShippingRate[] | null {
  return null;
}

export function writeCachedShippingRates(
  key: string,
  rates: readonly ShippingRate[],
): void {
  const cache = readCacheFromStorage();
  delete cache[key];

  const keys = Object.keys(cache);
  while (keys.length >= MAX_ENTRIES) {
    const oldestKey = keys.shift();
    if (oldestKey == null) break;
    delete cache[oldestKey];
  }

  cache[key] = { rates: [...rates], fetchedAt: Date.now() };
  writeCacheToStorage(cache);
}

export function clearShippingRatesCache(): void {
  try {
    window.sessionStorage.removeItem(SHIPPING_RATES_CACHE_KEY);
  } catch {}
}
