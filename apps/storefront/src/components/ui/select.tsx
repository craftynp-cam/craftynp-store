"use client";

import { Description } from "@heroui/react/description";
import { FieldError } from "@heroui/react/field-error";
import { Label } from "@heroui/react/label";
import { ListBox } from "@heroui/react/list-box";
import { Select as HeroSelect } from "@heroui/react/select";

import type { FieldProps } from ".";

export type SelectOption = {
  id: string;
  label: string;
  isDisabled?: boolean;
};

type SelectProps = Omit<
  React.ComponentProps<typeof HeroSelect>,
  "children" | "items"
> &
  FieldProps & {
    options: readonly SelectOption[];
    placeholder?: string;
  };

export function Select({
  label,
  description,
  errorMessage,
  options,
  placeholder = "Select an option",
  ...rest
}: SelectProps) {
  return (
    <HeroSelect placeholder={placeholder} {...rest}>
      <Label>{label}</Label>
      <HeroSelect.Trigger>
        <HeroSelect.Value />
        <HeroSelect.Indicator />
      </HeroSelect.Trigger>
      {description ? <Description>{description}</Description> : null}
      {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}
      <HeroSelect.Popover>
        <ListBox>
          {options.map((option) => (
            <ListBox.Item
              key={option.id}
              id={option.id}
              textValue={option.label}
              isDisabled={option.isDisabled}
            >
              {option.label}
            </ListBox.Item>
          ))}
        </ListBox>
      </HeroSelect.Popover>
    </HeroSelect>
  );
}
