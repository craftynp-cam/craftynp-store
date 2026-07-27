"use client";

import { Chip } from "@heroui/react/chip";
import type { ReactNode } from "react";

/**
 * Built on HeroUI's Chip, not its Badge. HeroUI reserves Badge for the dot or
 * count that overlays another element (it takes a `placement` and expects a
 * Badge.Anchor); what the storefront needs — "Made to order", "Sold out" — is
 * a standalone pill, which is Chip.
 */
export type BadgeTone = "neutral" | "accent" | "success" | "danger";

const toneToColor = {
  neutral: "default",
  accent: "accent",
  success: "success",
  danger: "danger",
} as const satisfies Record<
  BadgeTone,
  NonNullable<React.ComponentProps<typeof Chip>["color"]>
>;

type BadgeProps = Omit<
  React.ComponentProps<typeof Chip>,
  "color" | "children"
> & {
  tone?: BadgeTone;
  children: ReactNode;
};

export function Badge({
  tone = "neutral",
  variant = "soft",
  children,
  ...rest
}: BadgeProps) {
  return (
    <Chip color={toneToColor[tone]} variant={variant} {...rest}>
      {children}
    </Chip>
  );
}
