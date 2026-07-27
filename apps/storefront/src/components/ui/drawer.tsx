"use client";

import {
  DrawerBackdrop,
  DrawerCloseTrigger,
  DrawerContent,
  DrawerDialog,
  DrawerHeading,
  DrawerRoot,
  DrawerTrigger as HeroDrawerTrigger,
} from "@heroui/react/drawer";
import type { ReactNode } from "react";

import { X } from "../icons";

export { DrawerRoot as Drawer };
export { HeroDrawerTrigger as DrawerTrigger };

type DrawerPlacement = "top" | "bottom" | "left" | "right";

type DrawerPanelProps = {
  placement?: DrawerPlacement;
  isDismissable?: boolean;
  className?: string;
  children: ReactNode | ((options: { close: () => void }) => ReactNode);
};

/**
 * Collapses HeroUI's Backdrop/Content/Dialog trio into one component — nav is
 * the only caller today and has no use for them independently.
 */
export function DrawerPanel({
  placement = "left",
  isDismissable,
  className,
  children,
}: DrawerPanelProps) {
  return (
    <DrawerBackdrop variant="opaque" isDismissable={isDismissable}>
      <DrawerContent placement={placement}>
        <DrawerDialog className={className}>{children}</DrawerDialog>
      </DrawerContent>
    </DrawerBackdrop>
  );
}

export function DrawerTitle(props: React.ComponentProps<typeof DrawerHeading>) {
  return <DrawerHeading {...props} />;
}

type DrawerCloseButtonProps = Omit<
  React.ComponentProps<typeof DrawerCloseTrigger>,
  "aria-label" | "children"
> & {
  /** Required: HeroUI's own close button hardcodes `aria-label="Close"`. */
  label: string;
};

/**
 * HeroUI's `DrawerCloseTrigger` falls back to its own `CloseIcon`, rendered
 * without `aria-hidden`, and hardcodes `aria-label="Close"`. Every glyph in
 * this app is decorative with the name on the control (see the icons
 * barrel), so this wrapper always supplies its own hidden icon and requires
 * a caller-provided label rather than trusting the vendor default.
 */
export function DrawerCloseButton({ label, ...rest }: DrawerCloseButtonProps) {
  return (
    <DrawerCloseTrigger aria-label={label} {...rest}>
      <X aria-hidden="true" />
    </DrawerCloseTrigger>
  );
}
