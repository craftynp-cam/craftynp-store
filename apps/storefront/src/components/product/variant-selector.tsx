"use client";

import { RadioButtonGroup } from "../ui";
import type { ProductDetailOption } from "@/lib/product";

type VariantSelectorProps = {
  options: readonly ProductDetailOption[];
  selected: Record<string, string>;
  onChange: (optionId: string, valueId: string) => void;
  availability: Record<string, Record<string, boolean>>;
};

export function VariantSelector({
  options,
  selected,
  onChange,
  availability,
}: VariantSelectorProps) {
  return (
    <div className="flex flex-col gap-6">
      {options.map((option) => {
        const narrowedByAnotherOption = options.some(
          (other) => other.id !== option.id && selected[other.id] != null,
        );
        const reason = narrowedByAnotherOption
          ? "unavailable with your current selection"
          : "sold out";
        const hasUnavailable = option.values.some(
          (value) => availability[option.id]?.[value.id] === false,
        );

        return (
          <RadioButtonGroup
            key={option.id}
            label={option.title}
            isRequired
            description={
              hasUnavailable
                ? `Struck-through choices are ${reason}.`
                : undefined
            }
            value={selected[option.id] ?? ""}
            onChange={(value) => onChange(option.id, value)}
            options={option.values.map((value) => ({
              value: value.id,
              label: value.value,
              subLabel: value.subLabel,
              isDisabled: availability[option.id]?.[value.id] === false,
              disabledReason: reason,
            }))}
          />
        );
      })}
    </div>
  );
}
