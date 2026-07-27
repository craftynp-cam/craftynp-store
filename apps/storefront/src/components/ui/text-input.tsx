"use client";

import { Description } from "@heroui/react/description";
import { FieldError } from "@heroui/react/field-error";
import { Input } from "@heroui/react/input";
import { Label } from "@heroui/react/label";
import { TextField } from "@heroui/react/textfield";

/**
 * Label, helper text, and error text are wired to the control by React Aria's
 * TextField: it owns the ids and composes aria-describedby from whichever of
 * Description/FieldError are present, and sets aria-invalid from isInvalid.
 * That wiring is why these fields compose rather than take flat props.
 */
export type FieldProps = {
  label: string;
  /** Helper text. Always described, whether or not the field is invalid. */
  description?: string;
  /** Shown, and described, only while `isInvalid`. */
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
