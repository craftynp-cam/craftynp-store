import Image from "next/image";
import Link from "next/link";

import { ArrowRight } from "../icons";
import { Container } from "../ui";

export type CategorySlideProps = {
  name: string;
  href: string;
  productCount: number;
  imageUrl: string;
  imageAlt: string;
  isActive: boolean;
  position: number;
  total: number;
  isFirst?: boolean;
};

const ctaClassName =
  "inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-base font-semibold text-on-accent transition-colors hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-off-white focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

const countLinkClassName =
  "inline-flex items-center gap-1 text-off-white/80 underline-offset-4 transition-colors hover:text-off-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-off-white focus-visible:ring-offset-2 focus-visible:ring-offset-ink rounded-sm";

export function CategorySlide({
  name,
  href,
  productCount,
  imageUrl,
  imageAlt,
  isActive,
  position,
  total,
  isFirst,
}: CategorySlideProps) {
  const NameTag = isActive ? "h1" : "p";
  const nameClassName =
    "font-display text-4xl text-off-white sm:text-5xl 2xl:text-6xl";

  return (
    <div
      role="group"
      aria-roledescription="slide"
      aria-label={`${position} of ${total}: ${name}`}
      inert={isActive ? undefined : true}
      aria-hidden={isActive ? undefined : true}
      className="relative flex size-full shrink-0 flex-col justify-end overflow-hidden bg-ink"
    >
      {imageUrl ? (
        <>
          <Image
            src={imageUrl}
            alt={imageAlt}
            fill
            priority={isFirst}
            sizes="100vw"
            className="object-cover"
          />
          {/* Sized so the weakest text here — the off-white/80 count link —
              still clears 4.5:1 over a pure-white photo, which the solid
              bg-ink panel used to guarantee for free. */}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/65 to-ink/15"
          />
        </>
      ) : (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[repeating-linear-gradient(45deg,color-mix(in_srgb,var(--color-off-white)_8%,transparent)_0,color-mix(in_srgb,var(--color-off-white)_8%,transparent)_1px,transparent_1px,transparent_12px)]"
        />
      )}

      <Container className="relative py-8 sm:py-12 lg:py-16">
        <div className="flex flex-col items-start gap-4">
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
      </Container>
    </div>
  );
}
