"use client";

import { useState } from "react";

import type { CustomizationInputMode } from "@craftynp/types";

import { Textarea } from "../ui";
import {
  characterCountHint,
  nearLimitAnnouncement,
} from "@/lib/product-customization";

export type CountedTextFieldProps = {
  label: string;
  mode: Exclude<CustomizationInputMode, "off">;
  value: string;
  onChange: (next: string) => void;
  maxLength: number;
  // What the field is for, ahead of the character count. Only order notes
  // carry one: custom text is named by what it is, and a note is not.
  guidance?: string;
  // Shown once the shopper leaves the field empty. Each field words this in
  // its own terms — what the piece needs is not what the maker needs to know.
  requiredMessage: string;
  rows?: number;
  // Over the limit, derived by ProductPurchase so the same string that adds a
  // clause to the one add-to-cart hint is the one the field shows.
  errorMessage?: string | null;
};

// HeroUI's TextField wires exactly one Description into aria-describedby, so
// the guidance and the count share it rather than competing for it.
function fieldDescription(
  guidance: string | undefined,
  mode: Exclude<CustomizationInputMode, "off">,
  value: string,
  maxLength: number,
): string {
  const count = characterCountHint(mode, value, maxLength);
  return guidance ? `${guidance} ${count}` : count;
}

// Both configurator text fields are this one. A textarea, not an input, even
// for a single line of engraving: an input clips a long value out of sight at
// the right-hand edge, and the shopper has to be able to read the whole of
// what they typed (CNP-37 AC 1). The value it carries is still one string —
// nothing here adds line breaks.
export function CountedTextField({
  label,
  mode,
  value,
  onChange,
  maxLength,
  guidance,
  requiredMessage,
  rows = 2,
  errorMessage = null,
}: CountedTextFieldProps) {
  const [isVisited, setIsVisited] = useState(false);

  const trimmed = value.trim();
  const error =
    errorMessage ??
    (mode === "required" && trimmed === "" ? requiredMessage : null);

  // An untouched field is not yet wrong, so the empty-required message waits
  // for the shopper to leave it. A length error cannot be untouched — there is
  // text there — so it shows as they type.
  const showsError = error !== null && (trimmed !== "" || isVisited);

  return (
    <div className="flex flex-col gap-3">
      <Textarea
        label={label}
        description={fieldDescription(guidance, mode, value, maxLength)}
        isRequired={mode === "required"}
        isInvalid={showsError}
        errorMessage={showsError ? error : undefined}
        value={value}
        onChange={onChange}
        rows={rows}
        onFocusChange={(isFocused) => {
          if (!isFocused) setIsVisited(true);
        }}
      />

      <span role="status" className="sr-only">
        {nearLimitAnnouncement(value, maxLength)}
      </span>
    </div>
  );
}
