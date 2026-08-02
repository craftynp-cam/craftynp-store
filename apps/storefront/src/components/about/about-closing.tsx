import Link from "next/link";

const HEADING_ID = "about-closing-heading";

const ctaClassName =
  "mt-8 inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-base font-semibold text-on-primary transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-soft";

export type AboutClosingProps = {
  heading: string;
  body: string;
  ctaLabel: string;
};

export function AboutClosing({ heading, body, ctaLabel }: AboutClosingProps) {
  if (!heading && !body) {
    return null;
  }

  return (
    <section
      aria-labelledby={HEADING_ID}
      className="bg-surface-soft py-16 text-center sm:py-20"
    >
      <div className="mx-auto max-w-2xl px-4">
        <h2 id={HEADING_ID} className="font-display text-3xl sm:text-4xl">
          {heading}
        </h2>
        {body ? (
          <p className="mt-4 text-lg text-foreground-muted">{body}</p>
        ) : null}
        {ctaLabel ? (
          <Link href="/products" className={ctaClassName}>
            {ctaLabel}
          </Link>
        ) : null}
      </div>
    </section>
  );
}
