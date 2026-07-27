"use client";

import { List } from "../icons";

/**
 * Opens the nav drawer. The drawer itself — open state, focus trap, category
 * fetch — is CNP-25; this button is the trigger CNP-24 ships, inert until
 * that story wires an `onPress`.
 */
export function MenuButton() {
  return (
    <button
      type="button"
      aria-expanded={false}
      className="inline-flex size-10 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <List aria-hidden="true" size={22} />
      <span className="sr-only">Open menu</span>
    </button>
  );
}
