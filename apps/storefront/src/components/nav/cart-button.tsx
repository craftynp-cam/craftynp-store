"use client";

import { useSyncExternalStore } from "react";

import {
  cartLineCount,
  readCart,
  readServerCart,
  subscribeToCart,
} from "@/lib/cart";

import { DrawerTrigger } from "../ui";
import { ShoppingCartSimple } from "../icons";

/**
 * The trigger for `CartDrawer` (CNP-47) — its count is genuinely live: it
 * reads `cart.ts` through `useSyncExternalStore`, the same pattern
 * `ThemeToggle` uses for the theme preference. The server cannot know the
 * cart, so it renders empty and the client corrects it on hydration — that's
 * also the correct empty state, so there's nothing to flash.
 *
 * No badge renders at all when the count is 0, and the accessible name always
 * carries the number so a screen-reader user gets it without the glyph.
 */
export function CartButton() {
  const count = useSyncExternalStore(
    subscribeToCart,
    () => cartLineCount(readCart()),
    () => cartLineCount(readServerCart()),
  );
  const label = count > 0 ? `Cart, ${count} items` : "Cart, empty";

  return (
    <DrawerTrigger
      aria-label={label}
      className="relative inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <ShoppingCartSimple aria-hidden="true" size={18} />
      <span aria-hidden="true" className="hidden sm:inline">
        Cart
      </span>
      {count > 0 ? (
        <span
          aria-hidden="true"
          className="inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 py-0.5 text-xs font-semibold text-on-accent"
        >
          {count}
        </span>
      ) : null}
    </DrawerTrigger>
  );
}
