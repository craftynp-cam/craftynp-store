"use client";

import { Description } from "@heroui/react/description";
import { Label } from "@heroui/react/label";
import { Switch as HeroSwitch } from "@heroui/react/switch";
import type { ReactNode } from "react";

type SwitchProps = Omit<React.ComponentProps<typeof HeroSwitch>, "children"> & {
  label: ReactNode;
  description?: ReactNode;
};

export function Switch({ label, description, ...rest }: SwitchProps) {
  return (
    <HeroSwitch {...rest}>
      <HeroSwitch.Content>
        <div className="flex flex-col gap-0.5">
          <Label>{label}</Label>
          {description ? <Description>{description}</Description> : null}
        </div>
        <HeroSwitch.Control>
          <HeroSwitch.Thumb />
        </HeroSwitch.Control>
      </HeroSwitch.Content>
    </HeroSwitch>
  );
}
