import type { OrderStatus, OrderTracking } from "@craftynp/types";

import { ORDER_STATUS_COPY, TRACKING_STATUS_COPY } from "@/lib/order-status";

const HEADING_ID = "order-tracking-heading";

export type OrderTrackingCardProps = {
  status: OrderStatus;
  tracking: OrderTracking | null;
};

export function OrderTrackingCard({
  status,
  tracking,
}: OrderTrackingCardProps) {
  const isOnItsWay = status === "shipped" || status === "delivered";

  if (!isOnItsWay && !tracking) return null;

  return (
    <section
      aria-labelledby={HEADING_ID}
      className="rounded-xl border border-border bg-surface p-6"
    >
      <h2
        id={HEADING_ID}
        className="text-xs font-semibold uppercase tracking-widest text-foreground-muted"
      >
        Tracking
      </h2>

      <div className="mt-3 space-y-1 text-foreground">
        <p className="font-medium">{ORDER_STATUS_COPY[status].description}</p>

        {tracking ? (
          <>
            <p>
              {tracking.trackingUrl ? (
                <a
                  href={tracking.trackingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-primary underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {tracking.trackingNumber}
                </a>
              ) : (
                <span className="font-medium">{tracking.trackingNumber}</span>
              )}
            </p>
            <p className="text-foreground-muted">
              {tracking.statusDescription ??
                TRACKING_STATUS_COPY[tracking.status]}
            </p>
          </>
        ) : (
          <p className="text-foreground-muted">
            A tracking number will appear here as soon as the carrier scans your
            parcel.
          </p>
        )}
      </div>
    </section>
  );
}
