"use client";

import type {
  CustomDimensionErrors,
  CustomizationInputMode,
  ProductCustomization,
} from "@craftynp/types";

import { Checkbox, TextInput, Textarea } from "../ui";
import { ArtworkUpload } from "./artwork-upload";
import {
  isCustomSizeOffered,
  usesCustomSize,
  type CustomizationDraft,
} from "@/lib/product-customization";

type ProductConfiguratorProps = {
  customization: ProductCustomization;
  value: CustomizationDraft;
  onChange: (next: CustomizationDraft) => void;
  sizeErrors: CustomDimensionErrors;
  onCustomSizeChange: (useCustomSize: boolean) => void;
};

function hint(mode: CustomizationInputMode): string | undefined {
  return mode === "optional" ? "Optional." : undefined;
}

export function ProductConfigurator({
  customization,
  value,
  onChange,
  sizeErrors,
  onCustomSizeChange,
}: ProductConfiguratorProps) {
  const { inputs, size } = customization;
  const showsCustomSize = usesCustomSize(customization, value);

  function patch(change: Partial<CustomizationDraft>) {
    onChange({ ...value, ...change });
  }

  return (
    <div className="flex flex-col gap-6 border-t border-border pt-6">
      <h2 className="font-display text-xl">Make it yours</h2>

      {inputs.artwork !== "off" ? (
        <ArtworkUpload
          value={value.artwork}
          onChange={(artwork) => patch({ artwork })}
          label={
            inputs.artwork === "required"
              ? "Your artwork"
              : "Your artwork (optional)"
          }
        />
      ) : null}

      {inputs.customText !== "off" ? (
        <TextInput
          label="Custom text"
          description={hint(inputs.customText)}
          isRequired={inputs.customText === "required"}
          value={value.customText}
          onChange={(customText) => patch({ customText })}
          maxLength={120}
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
        <Textarea
          label="Order notes"
          description={hint(inputs.orderNotes)}
          isRequired={inputs.orderNotes === "required"}
          value={value.orderNotes}
          onChange={(orderNotes) => patch({ orderNotes })}
          maxLength={500}
        />
      ) : null}
    </div>
  );
}
