"use client";

import { RadioGroup } from "../ui";
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
    <div className="flex flex-col gap-4">
      {options.map((option) => (
        <RadioGroup
          key={option.id}
          label={option.title}
          orientation="horizontal"
          value={selected[option.id] ?? ""}
          onChange={(value) => onChange(option.id, value)}
          options={option.values.map((value) => ({
            value: value.id,
            label: value.value,
            isDisabled: availability[option.id]?.[value.id] === false,
          }))}
        />
      ))}
    </div>
  );
}
