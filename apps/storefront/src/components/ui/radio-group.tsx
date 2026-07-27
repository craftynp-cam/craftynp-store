"use client";

import { Description } from "@heroui/react/description";
import { FieldError } from "@heroui/react/field-error";
import { Label } from "@heroui/react/label";
import { Radio } from "@heroui/react/radio";
import { RadioGroup as HeroRadioGroup } from "@heroui/react/radio-group";

import type { FieldProps } from ".";

export type RadioOption = {
  value: string;
  label: string;
  isDisabled?: boolean;
};

type RadioGroupProps = Omit<
  React.ComponentProps<typeof HeroRadioGroup>,
  "children"
> &
  FieldProps & {
    options: readonly RadioOption[];
  };

/**
 * The group — not the individual radio — owns the label, helper, and error, so
 * the description is announced once when focus enters rather than on each
 * option.
 */
export function RadioGroup({
  label,
  description,
  errorMessage,
  options,
  ...rest
}: RadioGroupProps) {
  return (
    <HeroRadioGroup {...rest}>
      <Label>{label}</Label>
      {options.map((option) => (
        <Radio
          key={option.value}
          value={option.value}
          isDisabled={option.isDisabled}
        >
          <Radio.Content>
            <Radio.Control>
              <Radio.Indicator />
            </Radio.Control>
            {option.label}
          </Radio.Content>
        </Radio>
      ))}
      {description ? <Description>{description}</Description> : null}
      {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}
    </HeroRadioGroup>
  );
}
