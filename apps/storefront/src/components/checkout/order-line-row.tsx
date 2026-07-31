import Image from "next/image";

import type { OrderConfirmationLine } from "@craftynp/types";

import { formatMoney } from "@/lib/money";

export type OrderLineRowProps = {
  line: OrderConfirmationLine;
  currencyCode: string;
};

export function OrderLineRow({ line, currencyCode }: OrderLineRowProps) {
  return (
    <li className="flex items-start gap-4 px-6 py-4">
      <div className="relative size-12 shrink-0 overflow-hidden rounded-md bg-surface-soft">
        {line.thumbnail ? (
          <Image
            src={line.thumbnail}
            alt=""
            fill
            sizes="48px"
            className="object-cover"
          />
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <p className="font-semibold text-foreground">{line.title}</p>
        {line.variantTitle ? (
          <p className="text-sm text-foreground-muted">{line.variantTitle}</p>
        ) : null}
        <p className="text-sm text-foreground-muted">Qty {line.quantity}</p>

        {line.details.length > 0 ? (
          <dl className="mt-2 space-y-0.5 text-sm text-foreground-muted">
            {line.details.map((detail) => (
              <div key={detail.label} className="flex gap-2">
                <dt className="font-medium">{detail.label}:</dt>
                <dd className="min-w-0 break-words">{detail.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>

      <p className="shrink-0 font-semibold text-foreground">
        {formatMoney(line.lineTotal, currencyCode)}
      </p>
    </li>
  );
}
