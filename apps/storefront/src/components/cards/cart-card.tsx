"use client";

import Image from "next/image";
import Link from "next/link";

import type { CartLine } from "@/lib/cart";
import { formatMoney } from "@/lib/money";

import { Badge, QuantityStepper } from "../ui";
import { X } from "../icons";

export type CartCardProps = {
  line: CartLine;
  onQuantityChange: (id: string, quantity: number) => void;
  onRemove: (id: string) => void;
};

/**
 * The cart's line-item card (CNP-47) — deliberately mirrors `ProductCard`'s
 * badge and image-placeholder treatment so a line in the cart visibly matches
 * the card it came from. `details` is dormant until the configurator (CNP-9)
 * ships customizable products in Release 3; until then every line renders
 * with `isCustomizable` false and no `details`.
 */
export function CartCard({ line, onQuantityChange, onRemove }: CartCardProps) {
  const {
    id,
    href,
    title,
    imageUrl,
    imageAlt = title,
    unitPrice,
    currencyCode,
    quantity,
    isCustomizable = false,
    details,
  } = line;

  return (
    <li className="rounded-xl border border-border bg-surface p-4">
      <div className="flex gap-4">
        <div className="relative size-16 shrink-0 overflow-hidden rounded-lg">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={imageAlt}
              fill
              className="object-cover"
            />
          ) : (
            <div
              aria-hidden="true"
              className="size-full bg-surface-soft bg-[repeating-linear-gradient(45deg,var(--color-border)_0,var(--color-border)_1px,transparent_1px,transparent_12px)]"
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display text-lg">
              <Link href={href} className="hover:underline">
                {title}
              </Link>
            </h3>
            <button
              type="button"
              aria-label={`Remove ${title} from cart`}
              onClick={() => onRemove(id)}
              className="shrink-0 rounded-md p-1 text-foreground-muted transition-colors hover:bg-surface-soft hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X aria-hidden="true" size={18} />
            </button>
          </div>

          {isCustomizable ? (
            <Badge
              tone="accent"
              variant="primary"
              className="mt-2 uppercase tracking-wide"
            >
              Customizable
            </Badge>
          ) : (
            <Badge
              tone="success"
              variant="primary"
              className="mt-2 uppercase tracking-wide"
            >
              Ready to ship
            </Badge>
          )}
        </div>
      </div>

      {details && details.length > 0 ? (
        <dl className="mt-3 space-y-1 rounded-lg bg-surface-soft p-3 text-sm">
          {details.map((detail) => (
            <div key={detail.label} className="flex min-w-0 gap-2">
              <dt className="shrink-0 text-foreground-muted">
                {detail.label}:
              </dt>
              <dd className="min-w-0 truncate" title={detail.value}>
                {detail.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      <div className="mt-3 flex items-center justify-between gap-4">
        <QuantityStepper
          value={quantity}
          onChange={(next) => onQuantityChange(id, next)}
          label={`Quantity for ${title}`}
        />
        <p className="font-display text-lg">
          {formatMoney(unitPrice * quantity, currencyCode)}
        </p>
      </div>
    </li>
  );
}
