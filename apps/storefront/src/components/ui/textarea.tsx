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
        className="[field-sizing:content] max-h-64"
        // The field grows with what is typed instead of scrolling it out of
        // sight, and the cap only bites for a value far past any limit a field
        // of ours enforces. `field-sizing: content` makes the browser ignore
        // `rows` outright — a rows={4} box rendered at the same 39px as a
        // rows={2} one — so the floor rows used to provide is restored here,
        // in the element's own line heights plus HeroUI's padding and border.
        // Inline rather than a utility class because it is computed, and
        // because it has to beat the `min-height` HeroUI sets on `.textarea`.
        style={{
          minHeight: `calc(${rows} * 1lh + 1rem + 2 * var(--border-width-field, 1px))`,
        }}
      />
      {description ? <Description>{description}</Description> : null}
      {errorMessage ? (
        <FieldError>
          <span role="alert">{errorMessage}</span>
        </FieldError>
      ) : null}
    </TextField>
  );
}
