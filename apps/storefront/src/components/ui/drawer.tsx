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
  label: string;
};

export function DrawerCloseButton({ label, ...rest }: DrawerCloseButtonProps) {
  return (
    <DrawerCloseTrigger aria-label={label} {...rest}>
      <X aria-hidden="true" />
    </DrawerCloseTrigger>
  );
}
