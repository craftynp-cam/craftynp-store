import { Badge } from "../ui";

type ProductPriceProps = {
  price: string;
  originalPrice?: string;
  savingsLabel?: string;
  prefix?: string;
  lineTotal?: string;
  quantity?: number;
  isUpdating?: boolean;
};

export function ProductPrice({
  price,
  originalPrice,
  savingsLabel,
  prefix,
  lineTotal,
  quantity,
  isUpdating,
}: ProductPriceProps) {
  const isOnSale = originalPrice != null;
  // The last good price stays on screen while a new one is fetched — a blank
  // where the price goes reads as broken.
  const updatingClass = isUpdating ? " opacity-60" : "";

  const breakdown =
    lineTotal != null && quantity != null && quantity > 1 ? (
      <p className="text-sm text-foreground-muted">
        <span>{price} each</span>
        <span aria-hidden="true"> · </span>
        <span>
          {quantity} for {lineTotal}
        </span>
      </p>
    ) : null;

  return (
    <div aria-busy={isUpdating} className="flex flex-col gap-1">
      {isOnSale ? (
        <p
          className={`flex flex-wrap items-center gap-2 text-2xl font-medium${updatingClass}`}
        >
          <span className="sr-only">Now</span>
          <span className="text-danger-foreground">{price}</span>
          <span className="sr-only">Was</span>
          <s className="text-lg text-foreground-muted">{originalPrice}</s>
          {savingsLabel ? (
            <Badge tone="accent" variant="primary" className="text-sm">
              {savingsLabel}
            </Badge>
          ) : null}
        </p>
      ) : (
        <p className={`text-2xl font-medium${updatingClass}`}>
          {prefix ? (
            <span className="mr-2 text-base text-foreground-muted">
              {prefix}
            </span>
          ) : null}
          <span>{price}</span>
        </p>
      )}

      {breakdown}
    </div>
  );
}
