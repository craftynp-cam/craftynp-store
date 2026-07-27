"use client";

import { Description } from "@heroui/react/description";
import { FieldError } from "@heroui/react/field-error";
import { Label } from "@heroui/react/label";
import { ListBox } from "@heroui/react/list-box";
import { Select as HeroSelect } from "@heroui/react/select";

import type { FieldProps } from ".";

export type SelectOption = {
  /** Submitted value, and the React key. */
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
        {/* Left bare on purpose: React Aria's SelectValue already renders the
            selected item's text, falling back to the Select's placeholder. A
            render prop here has to resolve the text itself, which it cannot do
            before the listbox has ever been opened. */}
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
              // HeroUI wraps the label alongside a selection indicator, so the
              // children are not plain text and React Aria cannot infer the
              // string it needs for type-to-select.
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
