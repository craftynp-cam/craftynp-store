import type { CheckoutLineItemDetail } from "./checkout.js";
import type { LineItemCustomization } from "./customization.js";

export type LineItemOption = { title: string; value: string };

export function lineItemDetails({
  options,
  customization,
  sizeOptionTitle,
}: {
  options: readonly LineItemOption[];
  customization?: LineItemCustomization;
  sizeOptionTitle: string | null;
}): CheckoutLineItemDetail[] {
  const dimensions = customization?.dimensions;
  const details: CheckoutLineItemDetail[] = options
    .filter((option) => !(dimensions && option.title === sizeOptionTitle))
    .map((option) => ({ label: option.title, value: option.value }));

  if (customization?.artwork) {
    details.push({ label: "Artwork", value: customization.artwork.fileName });
  }

  if (customization?.customText) {
    details.push({
      label: "Custom text",
      value: customization.customText.value,
    });
  }

  if (dimensions) {
    details.push({
      label: "Size",
      value: `${dimensions.widthInches}″ × ${dimensions.heightInches}″`,
    });
  }

  if (customization?.orderNotes) {
    details.push({ label: "Order notes", value: customization.orderNotes });
  }

  return details;
}
