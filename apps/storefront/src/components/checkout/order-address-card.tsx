import type { OrderAddress } from "@craftynp/types";

const HEADING_ID = "order-shipping-to-heading";

export type OrderAddressCardProps = {
  address: OrderAddress;
};

export function OrderAddressCard({ address }: OrderAddressCardProps) {
  const recipient = [address.firstName, address.lastName]
    .filter(Boolean)
    .join(" ");
  const streetLine = [address.address1, address.address2]
    .filter(Boolean)
    .join(", ");
  const cityLine = [
    address.city,
    [address.state, address.postalCode].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <section
      aria-labelledby={HEADING_ID}
      className="rounded-xl border border-border bg-surface p-6"
    >
      <h2
        id={HEADING_ID}
        className="text-xs font-semibold uppercase tracking-widest text-foreground-muted"
      >
        Shipping to
      </h2>

      <div className="mt-3 space-y-0.5 text-foreground">
        {recipient ? <p>{recipient}</p> : null}
        {streetLine ? <p>{streetLine}</p> : null}
        {cityLine ? <p>{cityLine}</p> : null}
      </div>
    </section>
  );
}
