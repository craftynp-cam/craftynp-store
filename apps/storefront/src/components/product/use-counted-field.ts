"use client";

import { useState } from "react";

import type { CustomizationInputMode } from "@craftynp/types";

import {
  characterCountHint,
  nearLimitAnnouncement,
} from "@/lib/product-customization";

export type CountedFieldOptions = {
  mode: Exclude<CustomizationInputMode, "off">;
  value: string;
  maxLength: number;
  // Over the limit, derived by ProductPurchase so the same string that adds a
  // clause to the one add-to-cart hint is the one the field shows.
  lengthError: string | null;
  requiredMessage: string;
};

export type CountedField = {
  description: string;
  announcement: string;
  errorMessage: string | undefined;
  isInvalid: boolean;
  isRequired: boolean;
  onFocusChange: (isFocused: boolean) => void;
};

export function useCountedField({
  mode,
  value,
  maxLength,
  lengthError,
  requiredMessage,
}: CountedFieldOptions): CountedField {
  const [isVisited, setIsVisited] = useState(false);

  const trimmed = value.trim();
  const error =
    lengthError ??
    (mode === "required" && trimmed === "" ? requiredMessage : null);

  // An untouched field is not yet wrong, so the empty-required message waits
  // for the shopper to leave it. A length error cannot be untouched — there is
  // text there — so it shows as they type.
  const showsError = error !== null && (trimmed !== "" || isVisited);

  return {
    description: characterCountHint(mode, value, maxLength),
    announcement: nearLimitAnnouncement(value, maxLength),
    errorMessage: showsError ? error : undefined,
    isInvalid: showsError,
    isRequired: mode === "required",
    onFocusChange: (isFocused: boolean) => {
      if (!isFocused) setIsVisited(true);
    },
  };
}
