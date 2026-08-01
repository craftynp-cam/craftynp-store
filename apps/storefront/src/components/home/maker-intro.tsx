import Image from "next/image";
import Link from "next/link";

import { ArrowRight } from "../icons";
import { Container } from "../ui";

const HEADING_ID = "maker-intro-heading";

const linkClassName =
  "mt-8 inline-flex items-center gap-2 rounded-sm font-semibold underline underline-offset-4 transition-colors hover:text-foreground-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

export type MakerIntroProps = {
  eyebrow: string;
  heading: string;
  body: string;
  imageUrl: string;
  imageAlt: string;
  linkLabel: string;
};

export function MakerIntro({
  eyebrow,
  heading,
  body,
  imageUrl,
  imageAlt,
  linkLabel,
}: MakerIntroProps) {
  if (!heading && !body) {
    return null;
  }

  return (
    <section aria-labelledby={HEADING_ID} className="bg-surface py-16 sm:py-20">
      <Container className="grid gap-10 md:grid-cols-2 md:items-center md:gap-16">
        <div className="relative aspect-[4/5] overflow-hidden rounded-2xl">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={imageAlt}
              fill
              sizes="(min-width: 1536px) 800px, (min-width: 1280px) 700px, (min-width: 768px) 45vw, 100vw"
              className="object-cover"
            />
          ) : (
            <div
              aria-hidden="true"
              className="size-full bg-surface-soft bg-[repeating-linear-gradient(45deg,var(--color-border)_0,var(--color-border)_1px,transparent_1px,transparent_12px)]"
            />
          )}
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">
            {eyebrow}
          </p>
          <h2
            id={HEADING_ID}
            className="mt-4 font-display text-3xl sm:text-4xl"
          >
            {heading}
          </h2>
          <p className="mt-5 text-lg text-foreground-muted">{body}</p>
          <Link href="/about" className={linkClassName}>
            {linkLabel}
            <ArrowRight aria-hidden="true" size={18} />
          </Link>
        </div>
      </Container>
    </section>
  );
}
