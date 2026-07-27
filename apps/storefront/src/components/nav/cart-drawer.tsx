"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

import {
  cartLineCount,
  cartSubtotal,
  readCart,
  readServerCart,
  removeCartLine,
  setCartLineQuantity,
  subscribeToCart,
} from "@/lib/cart";
import {
  readCartDrawerOpen,
  setCartDrawerOpen,
  subscribeToCartDrawer,
} from "@/lib/cart-drawer";
import { formatMoney } from "@/lib/money";

import { CartCard } from "../cards";
import { Drawer, DrawerCloseButton, DrawerPanel, DrawerTitle } from "../ui";
import { CartButton } from "./cart-button";

const ctaClassName =
  "inline-flex w-full items-center justify-center rounded-full px-6 py-3 text-base font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/**
 * The header's cart drawer (CNP-47). Its open state is bound to
 * `cart-drawer.ts` rather than left as HeroUI's own internal state, so
 * `openCartDrawer()` (used by CNP-45 after a successful add-to-cart) can open
 * it programmatically, and so Escape/close/backdrop dismissal all funnel back
 * through the same store.
 */
export function CartDrawer() {
  const isOpen = useSyncExternalStore(
    subscribeToCartDrawer,
    readCartDrawerOpen,
    () => false,
  );
  const cart = useSyncExternalStore(subscribeToCart, readCart, readServerCart);
  const count = cartLineCount(cart);
  const { amount, currencyCode } = cartSubtotal(cart);
  const isEmpty = cart.lines.length === 0;

  return (
    <Drawer isOpen={isOpen} onOpenChange={setCartDrawerOpen}>
      <CartButton />
      <DrawerPanel
        placement="right"
        className="flex h-full w-full max-w-none flex-col rounded-none p-0 sm:w-[31.25rem] bg-surface-soft"
      >
        {({ close }) => (
          <>
            <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border bg-surface px-6 py-5">
              <DrawerTitle className="font-display text-2xl text-foreground">
                Your cart{" "}
                <span className="text-foreground-muted">({count})</span>
              </DrawerTitle>
              <DrawerCloseButton
                label="Close cart"
                className="static shrink-0 rounded-lg p-2 text-foreground hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              />
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6">
              {isEmpty ? (
                <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                  <h3 className="font-display text-xl">Your cart is empty</h3>
                  <p className="max-w-xs text-foreground-muted">
                    Browse the shop and anything you add will show up here.
                  </p>
                  <Link
                    href="/products"
                    onClick={close}
                    className={`${ctaClassName} border border-border bg-surface text-foreground hover:bg-surface-soft`}
                  >
                    Browse products
                  </Link>
                </div>
              ) : (
                <ul className="space-y-4">
                  {cart.lines.map((line) => (
                    <CartCard
                      key={line.id}
                      line={line}
                      onQuantityChange={setCartLineQuantity}
                      onRemove={removeCartLine}
                    />
                  ))}
                </ul>
              )}
            </div>

            <div className="shrink-0 space-y-4 border-t border-border bg-surface px-6 py-6">
              <div className="flex items-center justify-between font-display text-xl">
                <span>Subtotal</span>
                <span>{formatMoney(amount, currencyCode)}</span>
              </div>
              {isEmpty ? (
                <span
                  aria-disabled="true"
                  className={`${ctaClassName} cursor-not-allowed bg-accent/50 text-on-accent/70`}
                >
                  Checkout
                </span>
              ) : (
                <Link
                  href="/checkout"
                  className={`${ctaClassName} bg-accent text-on-accent hover:bg-accent/90`}
                >
                  Checkout
                </Link>
              )}
              <button
                type="button"
                onClick={close}
                className="w-full text-center font-medium text-primary hover:underline"
              >
                Keep shopping
              </button>
            </div>
          </>
        )}
      </DrawerPanel>
    </Drawer>
  );
}
