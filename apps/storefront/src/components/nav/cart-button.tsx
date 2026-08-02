"use client";

import { useSyncExternalStore } from "react";

import {
  cartLineCount,
  readCart,
  readServerCart,
  subscribeToCart,
} from "@/lib/cart";

import { ShoppingCartSimple } from "../icons";
import { DrawerTrigger } from "../ui";

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
