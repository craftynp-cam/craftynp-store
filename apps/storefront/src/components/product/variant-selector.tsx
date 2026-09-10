"use client";

import { RadioButtonGroup } from "../ui";
import type { ProductDetailOption } from "@/lib/product";
import type { OptionValueStatus } from "@/lib/variant";

type VariantSelectorProps = {
  options: readonly ProductDetailOption[];
  selected: Record<string, string>;
  onChange: (optionId: string, valueId: string) => void;
  availability: Record<string, Record<string, OptionValueStatus>>;
  disabledOptionIds?: ReadonlySet<string>;
  hiddenValueIds?: ReadonlySet<string>;
};

const REASONS = {
  sold_out: "sold out",
  incompatible: "unavailable with your current selection",
} as const;

function describeUnavailable(
  statuses: readonly OptionValueStatus[],
): string | undefined {
  const soldOut = statuses.includes("sold_out");
  const incompatible = statuses.includes("incompatible");

  if (soldOut && incompatible) {
    return `Struck-through choices are ${REASONS.sold_out} or ${REASONS.incompatible}.`;
  }
  if (soldOut) return `Struck-through choices are ${REASONS.sold_out}.`;
  if (incompatible)
    return `Struck-through choices are ${REASONS.incompatible}.`;
  return undefined;
}

export function VariantSelector({
  options,
  selected,
  onChange,
  availability,
  disabledOptionIds,
  hiddenValueIds,
}: VariantSelectorProps) {
  const choices = options
    .map((option) => ({
      ...option,
      values: option.values.filter((value) => !hiddenValueIds?.has(value.id)),
    }))
    .filter((option) => option.values.length > 1);
  if (choices.length === 0) return null;

  return (
    <div className="flex flex-col gap-6">
      {choices.map((option) => {
        const statusOf = (valueId: string): OptionValueStatus =>
          availability[option.id]?.[valueId] ?? "available";

        return (
          <RadioButtonGroup
            key={option.id}
            label={option.title}
            isRequired
            isDisabled={disabledOptionIds?.has(option.id)}
            description={describeUnavailable(
              option.values.map((value) => statusOf(value.id)),
            )}
            value={selected[option.id] ?? ""}
            onChange={(value) => onChange(option.id, value)}
            options={option.values.map((value) => {
              const status = statusOf(value.id);
              return {
                value: value.id,
                label: value.value,
                subLabel: value.subLabel,
                isDisabled: status !== "available",
                disabledReason:
                  status === "available" ? undefined : REASONS[status],
              };
            })}
          />
        );
      })}
    </div>
  );
}
