import Image from "next/image";
import Link from "next/link";

import { ArrowRight } from "../icons";

const HEADING_ID = "about-hero-heading";

const ctaClassName =
  "mt-8 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-base font-semibold text-on-accent transition-colors hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-off-white focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

export type AboutHeroProps = {
  eyebrow: string;
  heading: string;
  body: string;
  imageUrl: string;
  imageAlt: string;
  ctaLabel: string;
};

export function AboutHero({
  eyebrow,
  heading,
  body,
  imageUrl,
  imageAlt,
  ctaLabel,
}: AboutHeroProps) {
  if (!heading && !body) {
    return null;
  }

  return (
    <section aria-labelledby={HEADING_ID} className="bg-ink">
      <div className="mx-auto grid max-w-6xl md:grid-cols-2 md:items-center">
        <div className="px-4 py-16 sm:px-8 sm:py-20 md:py-24">
          <p className="text-xs font-semibold uppercase tracking-widest text-off-white/70">
            {eyebrow}
          </p>
          <h1
            id={HEADING_ID}
            className="mt-4 font-display text-4xl text-off-white sm:text-5xl"
          >
            {heading}
          </h1>
          <p className="mt-5 text-lg text-off-white/80">{body}</p>
          {ctaLabel ? (
            <Link href="/products" className={ctaClassName}>
              {ctaLabel}
              <ArrowRight aria-hidden="true" size={20} />
            </Link>
          ) : null}
        </div>

        <div className="relative aspect-[4/3] overflow-hidden md:aspect-auto md:h-full md:min-h-[28rem]">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={imageAlt}
              fill
              priority
              sizes="(min-width: 768px) 50vw, 100vw"
              className="object-cover"
            />
          ) : (
            <div
              aria-hidden="true"
              className="size-full bg-[repeating-linear-gradient(45deg,color-mix(in_srgb,var(--color-off-white)_8%,transparent)_0,color-mix(in_srgb,var(--color-off-white)_8%,transparent)_1px,transparent_1px,transparent_12px)]"
            />
          )}
        </div>
      </div>
    </section>
  );
}
