const HEADING_ID = "order-delivery-heading";

export type OrderDeliveryCardProps = {
  shippingMethodName: string | null;
  turnaroundNote: string;
  shippingWindowNote: string;
};

export function OrderDeliveryCard({
  shippingMethodName,
  turnaroundNote,
  shippingWindowNote,
}: OrderDeliveryCardProps) {
  return (
    <section
      aria-labelledby={HEADING_ID}
      className="rounded-xl border border-border bg-surface p-6"
    >
      <h2
        id={HEADING_ID}
        className="text-xs font-semibold uppercase tracking-widest text-foreground-muted"
      >
        What happens next
      </h2>

      <div className="mt-3 space-y-1 text-foreground">
        {turnaroundNote ? (
          <p className="font-medium">{turnaroundNote}</p>
        ) : null}
        {shippingWindowNote ? (
          <p className="text-foreground-muted">{shippingWindowNote}</p>
        ) : null}
        <p className="text-foreground-muted">
          {shippingMethodName
            ? `${shippingMethodName} · tracking sent when it ships`
            : "Tracking is sent when it ships"}
        </p>
      </div>
    </section>
  );
}
