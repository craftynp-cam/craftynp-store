import { Badge } from "../ui";

type ProductPriceProps = {
  price: string;
  originalPrice?: string;
  savingsLabel?: string;
};

export function ProductPrice({
  price,
  originalPrice,
  savingsLabel,
}: ProductPriceProps) {
  const isOnSale = originalPrice != null;

  if (!isOnSale) {
    return <p className="text-2xl font-medium">{price}</p>;
  }

  return (
    <p className="flex flex-wrap items-center gap-2 text-2xl font-medium">
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
  );
}
