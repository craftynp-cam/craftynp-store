import type { OrderConfirmation } from "@craftynp/types";

import { formatMoney } from "@/lib/money";
import { formatOrderDate } from "@/lib/order-format";

import { OrderLineRow } from "./order-line-row";

const HEADING_ID = "order-summary-heading";

export type OrderSummaryCardProps = {
  order: OrderConfirmation;
};

export function OrderSummaryCard({ order }: OrderSummaryCardProps) {
  const { currencyCode } = order.totals;
  const placedOn = formatOrderDate(order.placedAt);

  return (
    <section
      aria-labelledby={HEADING_ID}
      className="overflow-hidden rounded-xl border border-border bg-surface"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border bg-surface-soft px-6 py-4">
        <h2 id={HEADING_ID} className="font-display text-xl text-foreground">
          Order summary
        </h2>
        {placedOn ? (
          <p className="text-sm text-foreground-muted">Placed {placedOn}</p>
        ) : null}
      </div>

      <ul className="divide-y divide-border">
        {order.lines.map((line) => (
          <OrderLineRow key={line.id} line={line} currencyCode={currencyCode} />
        ))}
      </ul>

      <div className="space-y-2 border-t border-border bg-surface-soft px-6 py-5">
        <div className="flex items-center justify-between text-foreground-muted">
          <span>Subtotal</span>
          <span>{formatMoney(order.totals.subtotal, currencyCode)}</span>
        </div>
        <div className="flex items-center justify-between text-foreground-muted">
          <span>Shipping</span>
          <span>{formatMoney(order.totals.shipping, currencyCode)}</span>
        </div>
        <div className="flex items-center justify-between text-foreground-muted">
          <span>Tax</span>
          <span>{formatMoney(order.totals.tax, currencyCode)}</span>
        </div>
        <div className="flex items-baseline justify-between border-t border-border pt-3 text-foreground">
          <span className="font-semibold">Total paid</span>
          <span className="font-display text-2xl">
            {formatMoney(order.totals.total, currencyCode)}
          </span>
        </div>
      </div>
    </section>
  );
}
