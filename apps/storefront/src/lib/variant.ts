export const LOW_STOCK_THRESHOLD = 5;

export type Availability = "in_stock" | "low_stock" | "out_of_stock";

export type VariantInventorySource = {
  allow_backorder?: boolean | null;
  manage_inventory?: boolean | null;
  inventory_quantity?: number | null;
};

export function variantAvailability(
  variant: VariantInventorySource,
): Availability {
  if (variant.manage_inventory === false || variant.allow_backorder) {
    return "in_stock";
  }

  const quantity = variant.inventory_quantity ?? 0;
  if (quantity <= 0) return "out_of_stock";
  if (quantity <= LOW_STOCK_THRESHOLD) return "low_stock";
  return "in_stock";
}

export type VariantSelection = {
  id: string;
  optionValueIds: readonly string[];
  availability: Availability;
};

export function findVariant<T extends VariantSelection>(
  variants: readonly T[],
  selected: Record<string, string>,
  optionIds: readonly string[],
): T | undefined {
  const selectedValueIds = optionIds.map((optionId) => selected[optionId]);
  if (selectedValueIds.some((valueId) => valueId == null)) return undefined;

  return variants.find((variant) => {
    const variantValueIds = new Set(variant.optionValueIds);
    return selectedValueIds.every(
      (valueId) => valueId != null && variantValueIds.has(valueId),
    );
  });
}

export type OptionValueStatus = "available" | "sold_out" | "incompatible";

function hasPurchasableVariant<T extends VariantSelection>(
  variants: readonly T[],
  selection: Record<string, string>,
): boolean {
  const valueIds = Object.values(selection);

  return variants.some((variant) => {
    const variantValueIds = new Set(variant.optionValueIds);
    return (
      valueIds.every((valueId) => variantValueIds.has(valueId)) &&
      variant.availability !== "out_of_stock"
    );
  });
}

export function optionValueAvailability<T extends VariantSelection>(
  options: readonly { id: string; values: readonly { id: string }[] }[],
  variants: readonly T[],
  selected: Record<string, string>,
): Record<string, Record<string, OptionValueStatus>> {
  const result: Record<string, Record<string, OptionValueStatus>> = {};

  for (const option of options) {
    const forOption: Record<string, OptionValueStatus> = {};
    result[option.id] = forOption;

    for (const value of option.values) {
      if (!hasPurchasableVariant(variants, { [option.id]: value.id })) {
        forOption[value.id] = "sold_out";
        continue;
      }

      forOption[value.id] = hasPurchasableVariant(variants, {
        ...selected,
        [option.id]: value.id,
      })
        ? "available"
        : "incompatible";
    }
  }

  return result;
}
