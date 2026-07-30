"use client";

import { Description } from "@heroui/react/description";
import { FieldError } from "@heroui/react/field-error";
import { Label } from "@heroui/react/label";
import { Radio } from "@heroui/react/radio";
import { RadioGroup as HeroRadioGroup } from "@heroui/react/radio-group";

import type { FieldProps } from ".";

export type RadioCardOption = {
  value: string;
  label: string;
  description?: string;
  trailing?: string;
  isDisabled?: boolean;
};

type RadioCardGroupProps = Omit<
  React.ComponentProps<typeof HeroRadioGroup>,
  "children"
> &
  FieldProps & {
    options: readonly RadioCardOption[];
  };

export function RadioCardGroup({
  label,
  description,
  errorMessage,
  options,
  ...rest
}: RadioCardGroupProps) {
  return (
    <HeroRadioGroup {...rest}>
      {label ? <Label>{label}</Label> : null}
      <div className="flex flex-col gap-3">
        {options.map((option) => (
          <Radio
            key={option.value}
            value={option.value}
            isDisabled={option.isDisabled}
            className="rounded-xl border border-border bg-surface p-4 data-[selected]:border-2 data-[selected]:border-primary data-[selected]:bg-surface-soft"
          >
            <Radio.Content className="flex w-full items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Radio.Control>
                  <Radio.Indicator />
                </Radio.Control>
                <div className="flex flex-col">
                  <span className="font-medium text-foreground">
                    {option.label}
                  </span>
                  {option.description ? (
                    <span className="text-sm text-foreground-muted">
                      {option.description}
                    </span>
                  ) : null}
                </div>
              </div>
              {option.trailing ? (
                <span className="font-display text-foreground">
                  {option.trailing}
                </span>
              ) : null}
            </Radio.Content>
          </Radio>
        ))}
      </div>
      {description ? <Description>{description}</Description> : null}
      {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}
    </HeroRadioGroup>
  );
}
