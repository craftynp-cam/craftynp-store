"use client";

import { Checkbox as HeroCheckbox } from "@heroui/react/checkbox";
import type { ReactNode } from "react";

type CheckboxProps = Omit<
  React.ComponentProps<typeof HeroCheckbox>,
  "children"
> & {
  children: ReactNode;
};

export function Checkbox({ children, ...rest }: CheckboxProps) {
  return (
    <HeroCheckbox {...rest}>
      <HeroCheckbox.Content>
        <HeroCheckbox.Control>
          <HeroCheckbox.Indicator />
        </HeroCheckbox.Control>
        {children}
      </HeroCheckbox.Content>
    </HeroCheckbox>
  );
}
