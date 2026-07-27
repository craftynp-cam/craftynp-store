import Link from "next/link";

import { UserCircle } from "../icons";

/**
 * Entry point only. Accounts were pulled into Release 1 (CNP-11), so this
 * links to a real destination, but the auth flow and `/account` route
 * themselves are that epic's work, not CNP-24's.
 */
export function AccountLink() {
  return (
    <Link
      href="/account"
      aria-label="Account"
      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <UserCircle aria-hidden="true" size={20} />
      <span aria-hidden="true" className="hidden sm:inline">
        Account
      </span>
    </Link>
  );
}
