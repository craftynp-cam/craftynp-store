"use client";

import { useSyncExternalStore } from "react";

import {
  cartLineCount,
  readCart,
  readServerCart,
  removeCartLine,
  setCartLineQuantity,
  subscribeToCart,
} from "@/lib/cart";
import { checkoutTotals } from "@/lib/checkout";
import { formatMoney } from "@/lib/money";

import { CartCard } from "../cards";

export type CheckoutSummaryProps = {
  onEditCart: () => void;
};

export function CheckoutSummary({ onEditCart }: CheckoutSummaryProps) {
  const cart = useSyncExternalStore(subscribeToCart, readCart, readServerCart);
  const count = cartLineCount(cart);
  const { subtotal, total, currencyCode } = checkoutTotals(cart);

  return (
    <div className="mt-8 flex flex-col rounded-xl border border-border bg-surface lg:mt-0 lg:sticky lg:top-[calc(var(--chrome-height)+1.5rem)] lg:max-h-[calc(100svh-var(--chrome-height)-3rem)] lg:w-[22rem] lg:shrink-0 lg:self-start lg:overflow-y-auto">
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-6 py-5">
        <h2 className="font-display text-2xl text-foreground">
          Your cart <span className="text-foreground-muted">({count})</span>
        </h2>
        <button
          type="button"
          onClick={onEditCart}
          aria-label="Edit your cart"
          className="font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Edit
        </button>
      </div>

      <div className="bg-surface-soft px-6 py-6">
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
      </div>

      <div className="space-y-2 px-6 py-6">
        <div className="flex items-center justify-between text-foreground-muted">
          <span>Subtotal</span>
          <span>{formatMoney(subtotal, currencyCode)}</span>
        </div>
        <div className="flex items-center justify-between font-display text-xl text-foreground">
          <span>Total</span>
          <span>{formatMoney(total, currencyCode)}</span>
        </div>
      </div>
    </div>
  );
}
