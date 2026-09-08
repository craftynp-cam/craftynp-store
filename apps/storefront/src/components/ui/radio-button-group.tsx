"use client";

import { Description } from "@heroui/react/description";
import { FieldError } from "@heroui/react/field-error";
import { Label } from "@heroui/react/label";
import { Radio } from "@heroui/react/radio";
import { RadioGroup as HeroRadioGroup } from "@heroui/react/radio-group";

import type { FieldProps } from ".";

export type RadioButtonOption = {
  value: string;
  label: string;
  subLabel?: string;
  isDisabled?: boolean;
  disabledReason?: string;
};

type RadioButtonGroupProps = Omit<
  React.ComponentProps<typeof HeroRadioGroup>,
  "children"
> &
  FieldProps & {
    options: readonly RadioButtonOption[];
  };

function accessibleName(option: RadioButtonOption) {
  const parts = [option.label];
  if (option.subLabel) parts.push(option.subLabel);
  if (option.isDisabled && option.disabledReason) {
    parts.push(option.disabledReason);
  }
  return parts.join(", ");
}

export function RadioButtonGroup({
  label,
  description,
  errorMessage,
  options,
  isRequired,
  ...rest
}: RadioButtonGroupProps) {
  return (
    <HeroRadioGroup isRequired={isRequired} {...rest}>
      <Label>
        {label}
        {isRequired ? (
          <span
            aria-hidden="true"
            className="ml-2 text-xs font-medium uppercase tracking-wide text-foreground-muted"
          >
            Required
          </span>
        ) : null}
      </Label>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Radio
            key={option.value}
            value={option.value}
            isDisabled={option.isDisabled}
            aria-label={accessibleName(option)}
            className="mt-0 min-w-16 rounded-lg border border-border bg-surface px-4 py-2 text-left transition data-[disabled]:opacity-60 data-[hovered]:border-border-strong data-[selected]:border-2 data-[selected]:border-primary data-[selected]:bg-surface-soft data-[selected]:px-[15px] data-[selected]:py-[7px]"
          >
            <Radio.Content className="flex flex-col items-start gap-0.5">
              <span
                className={`text-sm font-medium text-foreground ${
                  option.isDisabled ? "line-through" : ""
                }`}
              >
                {option.label}
              </span>
              {option.subLabel ? (
                <span className="text-xs text-foreground-muted">
                  {option.subLabel}
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
