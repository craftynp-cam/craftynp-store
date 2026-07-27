import { Skeleton } from "@heroui/react/skeleton";
import Image from "next/image";
import Link from "next/link";

import { Badge } from "../ui";

export type ProductCardData = {
  isLoading?: false;
  href: string;
  title: string;
  category: string;
  imageUrl?: string;
  imageAlt?: string;
  price: string;
  originalPrice?: string;
  isFromPrice?: boolean;
  isCustomizable?: boolean;
};

/**
 * While loading there is no product yet to describe, so `isLoading` excludes
 * every other prop rather than making them optional alongside it — a caller
 * cannot accidentally pair a real href with a skeleton.
 */
export type ProductCardProps = { isLoading: true } | ProductCardData;

const cardShellClassName =
  "group focus-within:ring-primary relative overflow-hidden rounded-xl border border-border bg-surface shadow-sm transition hover:border-border-strong hover:shadow-md focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-background";

/**
 * The shared product card — reused by the category listing, search results,
 * and any future grid (CNP-28). Presentational only: callers pass already
 * formatted prices and pick the badge state; `toProductCardProps` in
 * `@/lib/product-card` derives these from a Medusa product.
 */
export function ProductCard(props: ProductCardProps) {
  if (props.isLoading) {
    return (
      <article className={cardShellClassName} aria-hidden="true">
        <Skeleton className="aspect-square w-full rounded-none" />
        <div className="p-4">
          <Skeleton className="h-4 w-2/5 rounded-md" />
          <Skeleton className="mt-2 h-6 w-4/5 rounded-md" />
          <Skeleton className="mt-3 h-5 w-1/4 rounded-md" />
        </div>
      </article>
    );
  }

  const {
    href,
    title,
    category,
    imageUrl,
    imageAlt = title,
    price,
    originalPrice,
    isFromPrice = false,
    isCustomizable = false,
  } = props;
  const isOnSale = originalPrice != null;

  return (
    <article className={cardShellClassName}>
      <div className="relative aspect-square overflow-hidden">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={imageAlt}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
          />
        ) : (
          <div
            aria-hidden="true"
            className="size-full bg-surface-soft bg-[repeating-linear-gradient(45deg,var(--color-border)_0,var(--color-border)_1px,transparent_1px,transparent_12px)]"
          />
        )}

        {isCustomizable ? (
          <Badge
            tone="accent"
            variant="primary"
            className="absolute top-3 left-3 uppercase tracking-wide"
          >
            Customizable
          </Badge>
        ) : (
          <Badge
            tone="success"
            variant="primary"
            className="absolute top-3 left-3 uppercase tracking-wide"
          >
            Ready to ship
          </Badge>
        )}

        {isOnSale ? (
          <Badge
            tone="accent"
            variant="primary"
            className="absolute top-3 right-3 uppercase tracking-wide"
          >
            Sale
          </Badge>
        ) : null}
      </div>

      <div className="p-4">
        <p className="text-sm text-foreground-muted">{category}</p>
        <h3 className="mt-1 font-display text-xl">
          <Link href={href} className="after:absolute after:inset-0">
            {title}
          </Link>
        </h3>
        <p className="mt-2 font-medium">
          {isOnSale ? (
            <>
              <span className="sr-only">Now</span>
              <span className="text-danger-foreground">{price}</span>{" "}
              <span className="sr-only">Was</span>
              <s className="text-foreground-muted">{originalPrice}</s>
            </>
          ) : (
            <>
              {isFromPrice ? "from " : ""}
              {price}
            </>
          )}
        </p>
      </div>
    </article>
  );
}
