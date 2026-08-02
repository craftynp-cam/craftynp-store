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
import type { ComponentProps, ReactNode } from "react";
import { useId } from "react";

import { setDrawerOpen } from "@/lib/drawer-open";

import { X } from "../icons";

export { HeroDrawerTrigger as DrawerTrigger };

export function Drawer({
  onOpenChange,
  ...rest
}: ComponentProps<typeof DrawerRoot>) {
  const id = useId();

  return (
    <DrawerRoot
      {...rest}
      onOpenChange={(isOpen) => {
        setDrawerOpen(id, isOpen);
        onOpenChange?.(isOpen);
      }}
    />
  );
}

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
