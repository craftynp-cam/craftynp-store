import Link from "next/link";

import { authLoginHref } from "@/lib/routes";

const HEADING_ID = "guest-account-prompt-heading";

const ctaClassName =
  "mt-4 inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-soft";

export type GuestAccountPromptProps = {
  returnTo: string;
};

export function GuestAccountPrompt({ returnTo }: GuestAccountPromptProps) {
  return (
    <section
      aria-labelledby={HEADING_ID}
      className="rounded-xl border border-border bg-surface-soft p-6"
    >
      <h2 id={HEADING_ID} className="font-display text-xl text-foreground">
        Want to keep track of this order?
      </h2>
      <p className="mt-2 text-foreground-muted">
        Create an account and your order history, addresses and proofs stay in
        one place. Your order is already confirmed either way &mdash; this link
        keeps working without one.
      </p>
      <Link
        href={authLoginHref({ screenHint: "signup", returnTo })}
        className={ctaClassName}
      >
        Create an account
      </Link>
    </section>
  );
}
