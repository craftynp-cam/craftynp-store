import Link from "next/link";

import { ArrowRight } from "../icons";

export type CategorySlideProps = {
  name: string;
  href: string;
  productCount: number;
  isActive: boolean;
  position: number;
  total: number;
};

const ctaClassName =
  "inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-base font-semibold text-on-accent transition-colors hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-off-white focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

const countLinkClassName =
  "inline-flex items-center gap-1 text-off-white/80 underline-offset-4 transition-colors hover:text-off-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-off-white focus-visible:ring-offset-2 focus-visible:ring-offset-ink rounded-sm";

/**
 * One slide of the homepage category carousel (CNP-29). Presentational and
 * stateless — `CategoryCarousel` owns which slide is active and drives every
 * prop here.
 *
 * AC 9: the active slide's name is the page's only `<h1>`; every other slide
 * renders the same text as a plain paragraph, so exactly one heading exists
 * at a time no matter which slide is showing.
 *
 * AC 8: inactive slides carry `inert` and `aria-hidden` so they drop out of
 * both the tab order and assistive tech, and the slide itself is labelled
 * with its position for whichever AT surface reads the live region.
 */
export function CategorySlide({
  name,
  href,
  productCount,
  isActive,
  position,
  total,
}: CategorySlideProps) {
  const NameTag = isActive ? "h1" : "p";
  const nameClassName = "font-display text-4xl text-off-white sm:text-5xl";

  return (
    <div
      role="group"
      aria-roledescription="slide"
      aria-label={`${position} of ${total}: ${name}`}
      inert={isActive ? undefined : true}
      aria-hidden={isActive ? undefined : true}
      className="relative flex size-full shrink-0 flex-col justify-end overflow-hidden bg-ink"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[repeating-linear-gradient(45deg,color-mix(in_srgb,var(--color-off-white)_8%,transparent)_0,color-mix(in_srgb,var(--color-off-white)_8%,transparent)_1px,transparent_1px,transparent_12px)]"
      />

      <div className="relative flex flex-col items-start gap-4 p-8 sm:p-12 lg:p-16">
        <NameTag className={nameClassName}>{name}</NameTag>
        <div className="flex flex-wrap items-center gap-4">
          <Link href={href} className={ctaClassName}>
            Shop {name}
            <ArrowRight aria-hidden="true" size={20} />
          </Link>
          {productCount > 0 ? (
            <Link href={href} className={countLinkClassName}>
              {productCount} {productCount === 1 ? "product" : "products"}
              <ArrowRight aria-hidden="true" size={16} />
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
