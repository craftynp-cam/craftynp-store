import { Check } from "../icons";

const HEADING_ID = "order-confirmation-heading";

export type OrderConfirmationHeroProps = {
  email: string;
  reference: string | null;
};

export function OrderConfirmationHero({
  email,
  reference,
}: OrderConfirmationHeroProps) {
  return (
    <section
      aria-labelledby={HEADING_ID}
      className="bg-ink px-4 py-16 sm:py-20"
    >
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-flex size-14 items-center justify-center rounded-full bg-accent">
          <Check
            aria-hidden="true"
            size={28}
            weight="bold"
            className="text-on-accent"
          />
        </span>

        <h1
          id={HEADING_ID}
          className="mt-6 font-display text-4xl text-off-white sm:text-5xl"
        >
          Thank you &mdash; your order is in
        </h1>

        <p className="mt-4 text-lg text-off-white/80">
          {email
            ? `A receipt is on its way to ${email}. I'll start on it right away.`
            : "A receipt is on its way to you. I'll start on it right away."}
        </p>

        {reference ? (
          <p className="mt-8 inline-flex items-center gap-3 rounded-full bg-off-white/10 px-6 py-3">
            <span className="text-xs font-semibold uppercase tracking-widest text-off-white/70">
              Confirmation
            </span>
            <span className="font-semibold tracking-wide text-off-white">
              {reference}
            </span>
          </p>
        ) : null}
      </div>
    </section>
  );
}
