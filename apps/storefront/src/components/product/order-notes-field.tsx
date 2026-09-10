"use client";

import type { CustomizationInputMode } from "@craftynp/types";

import { Textarea } from "../ui";
import { useCountedField } from "./use-counted-field";

export type OrderNotesFieldProps = {
  mode: Exclude<CustomizationInputMode, "off">;
  value: string;
  onChange: (next: string) => void;
  maxLength: number;
  errorMessage?: string | null;
};

const REQUIRED_MESSAGE = "Tell us what you'd like us to know about this piece.";

// Notes are instructions to the maker rather than something made into the
// piece, so there is nothing to echo back — the counter, the limit and the
// errors work exactly as the custom text field's do.
export function OrderNotesField({
  mode,
  value,
  onChange,
  maxLength,
  errorMessage = null,
}: OrderNotesFieldProps) {
  const field = useCountedField({
    mode,
    value,
    maxLength,
    lengthError: errorMessage,
    requiredMessage: REQUIRED_MESSAGE,
  });

  return (
    <div className="flex flex-col gap-3">
      <Textarea
        label="Order notes"
        description={field.description}
        isRequired={field.isRequired}
        isInvalid={field.isInvalid}
        errorMessage={field.errorMessage}
        value={value}
        onChange={onChange}
        onFocusChange={field.onFocusChange}
      />

      <span role="status" className="sr-only">
        {field.announcement}
      </span>
    </div>
  );
}
