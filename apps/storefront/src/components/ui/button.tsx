"use client";

import { Button as HeroButton } from "@heroui/react/button";
import { Spinner } from "@heroui/react/spinner";
import type { ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = Omit<
  React.ComponentProps<typeof HeroButton>,
  "variant" | "size" | "children"
> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /**
   * Blocks activation and shows a spinner. Distinct from `isDisabled`: React
   * Aria marks a pending button aria-disabled rather than disabled, so it
   * stays focusable and the reader is not dropped when a press starts work.
   */
  isLoading?: boolean;
  /** Announced while loading. Overridable for buttons with a specific verb. */
  loadingLabel?: string;
  children: ReactNode;
};

export function Button({
  variant = "primary",
  size = "md",
  isLoading = false,
  loadingLabel = "Loading",
  children,
  ...rest
}: ButtonProps) {
  return (
    <HeroButton variant={variant} size={size} isPending={isLoading} {...rest}>
      {isLoading ? (
        <>
          {/* The spinner is decorative; the text carries the state, so it is
              never signalled by colour or motion alone. React Aria supplies
              the aria-busy / aria-disabled pairing around it. */}
          <Spinner size="sm" aria-hidden="true" />
          <span className="sr-only">{loadingLabel}</span>
        </>
      ) : null}
      {children}
    </HeroButton>
  );
}
