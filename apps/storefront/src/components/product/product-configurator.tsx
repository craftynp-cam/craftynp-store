"use client";

import { ORDER_NOTES_MAX_LENGTH } from "@craftynp/types";
import type {
  CustomDimensionErrors,
  CustomizationInputKey,
  ProductCustomization,
} from "@craftynp/types";

import { Checkbox, TextInput } from "../ui";
import { ArtworkUpload } from "./artwork-upload";
import { CountedTextField } from "./counted-text-field";
import {
  isCustomSizeOffered,
  usesCustomSize,
  type CustomizationDraft,
} from "@/lib/product-customization";

// Order notes are the one field whose label does not say what it is for, and
// the shopper is otherwise left guessing what is worth telling the maker.
const ORDER_NOTES_GUIDANCE =
  "Placement, colour matching, a deadline — anything the options above don't cover.";

type ProductConfiguratorProps = {
  customization: ProductCustomization;
  value: CustomizationDraft;
  onChange: (next: CustomizationDraft) => void;
  sizeErrors: CustomDimensionErrors;
  onCustomSizeChange: (useCustomSize: boolean) => void;
  artworkError: string | null;
  artworkGuidance: string;
  customTextError: string | null;
  orderNotesError: string | null;
  fieldIds?: Partial<
    Record<
      | Exclude<CustomizationInputKey, "dimensions">
      | keyof CustomDimensionErrors,
      string
    >
  >;
};

export function ProductConfigurator({
  customization,
  value,
  onChange,
  sizeErrors,
  onCustomSizeChange,
  artworkError,
  artworkGuidance,
  customTextError,
  orderNotesError,
  fieldIds = {},
}: ProductConfiguratorProps) {
  const { inputs, size, text } = customization;
  const showsCustomSize = usesCustomSize(customization, value);

  function patch(change: Partial<CustomizationDraft>) {
    onChange({ ...value, ...change });
  }

  return (
    <div className="flex flex-col gap-6 border-t border-border pt-6">
      <h2 className="font-display text-xl">Make it yours</h2>

      {inputs.artwork !== "off" ? (
        <ArtworkUpload
          focusTargetId={fieldIds.artwork}
          value={value.artwork}
          onChange={(artwork) => patch({ artwork })}
          label={
            inputs.artwork === "required"
              ? "Your artwork"
              : "Your artwork (optional)"
          }
          guidance={artworkGuidance}
          errorMessage={artworkError}
        />
      ) : null}

      {inputs.customText !== "off" ? (
        <CountedTextField
          id={fieldIds.customText}
          label="Custom text"
          mode={inputs.customText}
          value={value.customText}
          onChange={(customText) => patch({ customText })}
          maxLength={text.maxLength}
          requiredMessage="Enter the text you'd like on this piece."
          errorMessage={customTextError}
        />
      ) : null}

      {inputs.dimensions !== "off" ? (
        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-medium text-foreground-muted uppercase tracking-wide">
            Size
          </legend>

          {isCustomSizeOffered(customization) ? (
            <Checkbox
              isSelected={value.useCustomSize}
              onChange={onCustomSizeChange}
            >
              Enter my own size
            </Checkbox>
          ) : null}

          {showsCustomSize ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput
                id={fieldIds.widthInches}
                label="Width (inches)"
                description={`Between ${size.minInches} and ${size.maxInches} inches.`}
                inputMode="decimal"
                isRequired
                isInvalid={Boolean(sizeErrors.widthInches)}
                errorMessage={sizeErrors.widthInches}
                value={value.widthInches}
                onChange={(widthInches) => patch({ widthInches })}
              />
              <TextInput
                id={fieldIds.heightInches}
                label="Height (inches)"
                description={`Between ${size.minInches} and ${size.maxInches} inches.`}
                inputMode="decimal"
                isRequired
                isInvalid={Boolean(sizeErrors.heightInches)}
                errorMessage={sizeErrors.heightInches}
                value={value.heightInches}
                onChange={(heightInches) => patch({ heightInches })}
              />
            </div>
          ) : null}
        </fieldset>
      ) : null}

      {inputs.orderNotes !== "off" ? (
        <CountedTextField
          id={fieldIds.orderNotes}
          label="Order notes"
          mode={inputs.orderNotes}
          value={value.orderNotes}
          onChange={(orderNotes) => patch({ orderNotes })}
          maxLength={ORDER_NOTES_MAX_LENGTH}
          guidance={ORDER_NOTES_GUIDANCE}
          requiredMessage="Tell us what you'd like us to know about this piece."
          rows={4}
          errorMessage={orderNotesError}
        />
      ) : null}
    </div>
  );
}
