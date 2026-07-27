"use client";

import { DrawerTrigger } from "../ui";
import { List } from "../icons";

export function MenuButton() {
  return (
    <DrawerTrigger className="inline-flex size-10 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background">
      <List aria-hidden="true" size={22} />
      <span className="sr-only">Open menu</span>
    </DrawerTrigger>
  );
}
