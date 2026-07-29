"use client";

import { Description } from "@heroui/react/description";
import { FieldError } from "@heroui/react/field-error";
import { Input } from "@heroui/react/input";
import { Label } from "@heroui/react/label";
import { TextField } from "@heroui/react/textfield";

export type FieldProps = {
  label: string;
  description?: string;
  errorMessage?: string;
  isInvalid?: boolean;
};

type TextInputProps = Omit<React.ComponentProps<typeof TextField>, "children"> &
  FieldProps & {
    placeholder?: string;
  };

export function TextInput({
  label,
  description,
  errorMessage,
  placeholder,
  ...rest
}: TextInputProps) {
  return (
    <TextField {...rest}>
      <Label>{label}</Label>
      <Input placeholder={placeholder} />
      {description ? <Description>{description}</Description> : null}
      {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}
    </TextField>
  );
}
