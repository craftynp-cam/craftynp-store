import Link from "next/link";

import { authLoginHref } from "@/lib/routes";

import { WarningCircle } from "../icons";

const errorMessages: Record<string, string> = {
  cancelled: "Sign-in was cancelled. No account was created.",
  auth_failed: "We couldn't sign you in. Please try again.",
};

export type SignInPanelProps = {
  error?: string;
  returnTo?: string;
};

const linkButtonClassName =
  "inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function SignInPanel({ error, returnTo }: SignInPanelProps) {
  const message = error
    ? (errorMessages[error] ?? errorMessages.auth_failed)
    : null;

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-foreground">Sign in</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Sign in or create an account to track your orders.
        </p>
      </div>

      {message ? (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-lg bg-danger px-3 py-2 text-sm font-medium text-danger-foreground"
        >
          <WarningCircle aria-hidden="true" size={18} />
          {message}
        </p>
      ) : null}

      <div className="flex flex-col gap-3">
        <Link
          href={authLoginHref({ returnTo })}
          className={`${linkButtonClassName} bg-primary text-on-primary hover:opacity-90`}
        >
          Continue with email
        </Link>
        <Link
          href={authLoginHref({ returnTo, connection: "google-oauth2" })}
          className={`${linkButtonClassName} border border-foreground/20 bg-surface text-foreground hover:bg-surface-soft`}
        >
          Continue with Google
        </Link>
      </div>
    </div>
  );
}
