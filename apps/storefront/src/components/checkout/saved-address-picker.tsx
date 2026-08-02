import { NEW_ADDRESS_ID, type SavedAddress } from "@/lib/saved-address";

import { RadioGroup } from "../ui";

export type SavedAddressPickerProps = {
  addresses: readonly SavedAddress[];
  selectedId: string;
  onSelect: (id: string) => void;
};

export function SavedAddressPicker({
  addresses,
  selectedId,
  onSelect,
}: SavedAddressPickerProps) {
  if (addresses.length === 0) return null;

  const options = [
    ...addresses.map((address) => ({
      value: address.id,
      label: address.label,
    })),
    { value: NEW_ADDRESS_ID, label: "Enter a new address" },
  ];

  return (
    <RadioGroup
      label="Use a saved address"
      options={options}
      value={selectedId}
      onChange={onSelect}
    />
  );
}
