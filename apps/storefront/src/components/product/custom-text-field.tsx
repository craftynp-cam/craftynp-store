"use client";

import { useId, useState } from "react";

import type { CustomizationInputMode } from "@craftynp/types";

import { TextInput } from "../ui";
import { customTextHint, customTextLength } from "@/lib/product-customization";

export type CustomTextFieldProps = {
  mode: Exclude<CustomizationInputMode, "off">;
  value: string;
  onChange: (next: string) => void;
  // Over the length limit, derived by the parent so the same string that feeds
  // the add-to-cart hint feeds the field.
  errorMessage?: string | null;
};

const REQUIRED_MESSAGE = "Enter the text you'd like on this piece.";

export function CustomTextField({
  mode,
  value,
  onChange,
  errorMessage = null,
}: CustomTextFieldProps) {
  const [isVisited, setIsVisited] = useState(false);
  const previewLabelId = useId();

  const trimmed = value.trim();
  const error =
    errorMessage ??
    (mode === "required" && trimmed === "" ? REQUIRED_MESSAGE : null);

  // An untouched field is not yet wrong, so the empty-required message waits
  // for the shopper to leave it. A length error cannot be untouched — there is
  // text there — so it shows as they type.
  const showsError = error !== null && (trimmed !== "" || isVisited);

  return (
    <div className="flex flex-col gap-3">
      <TextInput
        label="Custom text"
        description={customTextHint(mode, value)}
        isRequired={mode === "required"}
        isInvalid={showsError}
        errorMessage={showsError ? error : undefined}
        value={value}
        onChange={onChange}
        onFocusChange={(isFocused) => {
          if (!isFocused) setIsVisited(true);
        }}
      />

      {customTextLength(value) > 0 ? (
        <div
          role="group"
          aria-labelledby={previewLabelId}
          className="rounded-lg border border-border bg-surface-soft px-4 py-3"
        >
          <p
            id={previewLabelId}
            className="text-xs font-medium text-foreground-muted uppercase tracking-wide"
          >
            What we&rsquo;ll make
          </p>
          <p className="mt-1 font-display text-2xl break-words whitespace-pre-wrap">
            {trimmed}
          </p>
        </div>
      ) : null}
    </div>
  );
}
