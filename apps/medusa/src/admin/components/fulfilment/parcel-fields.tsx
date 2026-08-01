import { Button, Input, Label, Text } from "@medusajs/ui";
import { formatParcelSummary } from "@craftynp/types";
import type { ParcelOverride } from "@craftynp/types";

export type ParcelDraft = {
  weight: string;
  length: string;
  width: string;
  height: string;
};

const FIELDS: Array<{ key: keyof ParcelDraft; label: string }> = [
  { key: "weight", label: "Weight (grams)" },
  { key: "length", label: "Length (cm)" },
  { key: "width", label: "Width (cm)" },
  { key: "height", label: "Height (cm)" },
];

export function toDraft(parcel: ParcelOverride | null): ParcelDraft {
  if (!parcel) return { weight: "", length: "", width: "", height: "" };

  return {
    weight: String(parcel.weight),
    length: String(parcel.length),
    width: String(parcel.width),
    height: String(parcel.height),
  };
}

type Props = {
  idPrefix: string;
  draft: ParcelDraft;
  derived: ParcelOverride | null;
  disabled: boolean;
  onChange: (draft: ParcelDraft) => void;
};

export const ParcelFields = ({
  idPrefix,
  draft,
  derived,
  disabled,
  onChange,
}: Props) => (
  <div className="flex flex-col gap-2">
    <div className="flex items-center justify-between">
      <Text size="small" weight="plus">
        Parcel
      </Text>
      {derived && (
        <Button
          size="small"
          variant="transparent"
          disabled={disabled}
          onClick={() => onChange(toDraft(derived))}
        >
          Reset to calculated
        </Button>
      )}
    </div>

    <div className="grid grid-cols-2 gap-2">
      {FIELDS.map((field) => (
        <div key={field.key} className="flex flex-col gap-1">
          <Label size="xsmall" htmlFor={`${idPrefix}-${field.key}`}>
            {field.label}
          </Label>
          <Input
            id={`${idPrefix}-${field.key}`}
            type="number"
            min="1"
            inputMode="decimal"
            value={draft[field.key]}
            disabled={disabled}
            onChange={(event) =>
              onChange({ ...draft, [field.key]: event.target.value })
            }
          />
        </div>
      ))}
    </div>

    <Text size="xsmall" className="text-ui-fg-subtle">
      {derived
        ? `Calculated from the products: ${formatParcelSummary(derived)}`
        : "These products have no saved weight or size, so enter the parcel yourself."}
    </Text>
  </div>
);
