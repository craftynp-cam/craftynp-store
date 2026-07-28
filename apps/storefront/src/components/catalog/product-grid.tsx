import Link from "next/link";

import { ProductCard, type ProductCardData } from "../cards";

type ProductGridProps = { products: readonly ProductCardData[] };

export function ProductGrid({ products }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-foreground-muted">
          No products in this category yet.
        </p>
        <Link
          href="/products"
          className="font-semibold text-primary underline underline-offset-4 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Browse all products
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {products.map((product) => (
        <ProductCard key={product.href} {...product} />
      ))}
    </div>
  );
}
