"use client";

import { DrawerTrigger } from "../ui";
import { List } from "../icons";

/**
 * Opens the nav drawer (CNP-25). Must render inside a `<Drawer>` — it's a RAC
 * `Button` under the hood, so `Drawer`'s `DialogTrigger` supplies
 * `aria-expanded`/`aria-haspopup` itself; this component must not set them.
 */
export function MenuButton() {
  return (
    <DrawerTrigger className="inline-flex size-10 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background">
      <List aria-hidden="true" size={22} />
      <span className="sr-only">Open menu</span>
    </DrawerTrigger>
  );
}
