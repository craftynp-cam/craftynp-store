import type { SavedAddress } from "@/lib/saved-address";

import { Badge, Button } from "../ui";

export type AddressCardProps = {
  address: SavedAddress;
  onEdit: () => void;
  onSetDefault: () => void;
  onRemove: () => void;
};

export function AddressCard({
  address,
  onEdit,
  onSetDefault,
  onRemove,
}: AddressCardProps) {
  const cityLine = [
    address.city,
    [address.state, address.postalCode].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div
      className={`rounded-xl border bg-surface p-6 ${
        address.isDefaultShipping ? "border-2 border-primary" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-lg text-foreground">
          {address.addressName || "Address"}
        </h3>
        {address.isDefaultShipping ? (
          <Badge tone="accent">Default</Badge>
        ) : null}
      </div>

      <div className="mt-3 space-y-0.5 text-sm text-foreground-muted">
        <p>{[address.firstName, address.lastName].filter(Boolean).join(" ")}</p>
        <p>
          {address.address1}
          {address.address2 ? `, ${address.address2}` : ""}
        </p>
        <p>{cityLine}</p>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onPress={onEdit}>
            Edit
          </Button>
          {!address.isDefaultShipping ? (
            <Button variant="ghost" size="sm" onPress={onSetDefault}>
              Set as default
            </Button>
          ) : null}
        </div>
        <Button variant="danger" size="sm" onPress={onRemove}>
          Remove
        </Button>
      </div>
    </div>
  );
}
