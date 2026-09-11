"use client";

import { Description } from "@heroui/react/description";
import { FieldError } from "@heroui/react/field-error";
import { Label } from "@heroui/react/label";
import { TextArea as HeroTextArea } from "@heroui/react/textarea";
import { TextField } from "@heroui/react/textfield";

import type { FieldProps } from ".";

type TextareaProps = Omit<React.ComponentProps<typeof TextField>, "children"> &
  FieldProps & {
    placeholder?: string;
    rows?: number;
  };

export function Textarea({
  label,
  description,
  errorMessage,
  placeholder,
  rows = 4,
  ...rest
}: TextareaProps) {
  return (
    <TextField {...rest}>
      <Label>{label}</Label>
      <HeroTextArea
        placeholder={placeholder}
        rows={rows}
        // The field grows with what is typed instead of scrolling it out of
        // sight; `rows` is the floor, and the cap only bites for a value far
        // past any limit a field of ours enforces.
        className="[field-sizing:content] max-h-64"
      />
      {description ? <Description>{description}</Description> : null}
      {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}
    </TextField>
  );
}
