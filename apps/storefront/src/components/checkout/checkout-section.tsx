export type CheckoutSectionProps = {
  step: number;
  title: string;
  children: React.ReactNode;
};

export function CheckoutSection({
  step,
  title,
  children,
}: CheckoutSectionProps) {
  const headingId = `checkout-step-${step}-heading`;

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-xl border border-border bg-surface p-6"
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary font-display text-on-primary"
        >
          {step}
        </span>
        <h2 id={headingId} className="font-display text-2xl text-foreground">
          <span className="sr-only">Step {step}: </span>
          {title}
        </h2>
      </div>
      <div className="mt-6 space-y-4">{children}</div>
    </section>
  );
}
