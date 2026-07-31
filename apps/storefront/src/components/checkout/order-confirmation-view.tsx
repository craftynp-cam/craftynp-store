import Link from "next/link";

import type { OrderConfirmation } from "@craftynp/types";

import { hasCustomLine, orderReference } from "@/lib/order-format";

import { GuestAccountPrompt } from "./guest-account-prompt";
import { OrderAddressCard } from "./order-address-card";
import { OrderConfirmationHero } from "./order-confirmation-hero";
import { OrderDeliveryCard } from "./order-delivery-card";
import { OrderSummaryCard } from "./order-summary-card";

const keepShoppingClassName =
  "inline-flex items-center justify-center rounded-lg border border-border-strong px-6 py-3 text-base font-semibold text-foreground transition-colors hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export type OrderConfirmationViewProps = {
  order: OrderConfirmation | null;
  fallbackDisplayId: string | null;
  turnaroundNote: string;
  shippingWindowNote: string;
  isSignedIn: boolean;
  returnTo: string;
};

export function OrderConfirmationView({
  order,
  fallbackDisplayId,
  turnaroundNote,
  shippingWindowNote,
  isSignedIn,
  returnTo,
}: OrderConfirmationViewProps) {
  const reference = order
    ? orderReference(order.displayId)
    : fallbackDisplayId
      ? orderReference(Number(fallbackDisplayId))
      : null;

  return (
    <>
      <OrderConfirmationHero email={order?.email ?? ""} reference={reference} />

      <div className="mx-auto max-w-2xl space-y-6 px-4 py-12 sm:py-16">
        {order ? (
          <>
            <OrderSummaryCard order={order} />

            <div className="grid gap-6 sm:grid-cols-2">
              {order.shippingAddress ? (
                <OrderAddressCard address={order.shippingAddress} />
              ) : null}
              <OrderDeliveryCard
                shippingMethodName={order.shippingMethodName}
                turnaroundNote={turnaroundNote}
                shippingWindowNote={shippingWindowNote}
              />
            </div>

            {hasCustomLine(order) ? (
              <p className="rounded-xl bg-surface-soft px-6 py-4 text-foreground-muted">
                Your order includes a custom item. I&rsquo;ll email a digital
                proof within 1&ndash;2 days &mdash; production starts once you
                approve it.
              </p>
            ) : null}
          </>
        ) : (
          <p className="rounded-xl border border-border bg-surface px-6 py-5 text-foreground-muted">
            Your order is confirmed. The full summary isn&rsquo;t loading right
            now, but your emailed receipt has everything on it.
          </p>
        )}

        <div className="flex justify-center">
          <Link href="/products" className={keepShoppingClassName}>
            Keep shopping
          </Link>
        </div>

        {!isSignedIn ? <GuestAccountPrompt returnTo={returnTo} /> : null}
      </div>
    </>
  );
}
