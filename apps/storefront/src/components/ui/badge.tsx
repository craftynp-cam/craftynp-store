"use client";

import { Chip } from "@heroui/react/chip";
import type { ReactNode } from "react";

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
