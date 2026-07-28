import Link from "next/link";

import { ArrowRight } from "../icons";

type ProductDetailsProps = {
  description: string;
  crossSellHref?: string;
};

export function ProductDetails({
  description,
  crossSellHref,
}: ProductDetailsProps) {
  return (
    <div className="border-t border-border pt-6">
      <h2 className="font-display text-2xl">Details</h2>
      <p className="mt-3 text-foreground-muted">
        {description}
        {crossSellHref ? (
          <>
            {" "}
            Want your own art on one?{" "}
            <Link
              href={crossSellHref}
              className="inline-flex items-center gap-1 font-medium text-foreground underline"
            >
              Order a custom version instead
              <ArrowRight aria-hidden="true" size={14} />
            </Link>
          </>
        ) : null}
      </p>
    </div>
  );
}
