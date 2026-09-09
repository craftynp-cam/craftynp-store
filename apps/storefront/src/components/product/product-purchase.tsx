"use client";

import { useMemo, useState } from "react";

import type { ProductCustomization } from "@craftynp/types";

import { Badge, Button, QuantityStepper } from "../ui";
import { ProductConfigurator } from "./product-configurator";
import { ProductPrice } from "./product-price";
import { StockStatus } from "./stock-status";
import { VariantSelector } from "./variant-selector";
import { addCartLine } from "@/lib/cart";
import { openCartDrawer } from "@/lib/cart-drawer";
import { formatMoney } from "@/lib/money";
import type { ProductDetailOption, ProductDetailVariant } from "@/lib/product";
import {
  EMPTY_CUSTOMIZATION_DRAFT,
  customizationDetails,
  missingInputsMessage,
  missingRequiredInputs,
  type CustomizationDraft,
} from "@/lib/product-customization";
import { findVariant, optionValueAvailability } from "@/lib/variant";

type ProductPurchaseProps = {
  title: string;
  href: string;
  imageUrl?: string;
  options: readonly ProductDetailOption[];
  variants: readonly ProductDetailVariant[];
  customization: ProductCustomization;
  selected: Record<string, string>;
  onOptionChange: (optionId: string, valueId: string) => void;
};

export function ProductPurchase({
  title,
  href,
  imageUrl,
  options,
  variants,
  customization,
  selected,
  onOptionChange,
}: ProductPurchaseProps) {
  const [quantity, setQuantity] = useState(1);
  const [draft, setDraft] = useState<CustomizationDraft>(
    EMPTY_CUSTOMIZATION_DRAFT,
  );

  const optionIds = useMemo(
    () => options.map((option) => option.id),
    [options],
  );

  const availability = useMemo(
    () => optionValueAvailability(options, variants, selected),
    [options, variants, selected],
  );

  const selectedVariant = findVariant(variants, selected, optionIds);
  const isSoldOut = selectedVariant?.availability === "out_of_stock";
  const isOutOfStock = selectedVariant == null || isSoldOut;

  const missingInputs = missingRequiredInputs(customization, draft);
  const missingMessage = missingInputsMessage(missingInputs);

  const totalPrice = selectedVariant?.price
    ? formatMoney(
        selectedVariant.calculatedAmount * quantity,
        selectedVariant.currencyCode,
      )
    : undefined;

  const detailsForCart = [
    ...options
      .map((option) => {
        const valueId = selected[option.id];
        const value = option.values.find(
          (candidate) => candidate.id === valueId,
        );
        return value ? { label: option.title, value: value.value } : undefined;
      })
      .filter((detail) => detail != null),
    ...customizationDetails(customization, draft),
  ];

  function handleAddToCart() {
    if (!selectedVariant || missingInputs.length > 0) return;

    addCartLine({
      id: selectedVariant.id,
      href,
      title,
      imageUrl,
      imageAlt: title,
      unitPrice: selectedVariant.calculatedAmount,
      currencyCode: selectedVariant.currencyCode,
      quantity,
      isCustomizable: customization.isCustomizable,
      details: detailsForCart,
    });
    openCartDrawer();
  }

  return (
    <div className="flex flex-col gap-6">
      <Badge
        tone={customization.isCustomizable ? "accent" : "success"}
        variant="primary"
        className="w-fit uppercase tracking-wide"
      >
        {customization.isCustomizable ? "Made to order" : "Ready to ship"}
      </Badge>

      <div>
        <h1 className="font-display text-4xl">{title}</h1>
      </div>

      <ProductPrice
        price={selectedVariant?.price ?? ""}
        originalPrice={selectedVariant?.originalPrice}
        savingsLabel={selectedVariant?.savingsLabel}
      />

      {selectedVariant ? (
        <StockStatus availability={selectedVariant.availability} />
      ) : null}

      {options.length > 0 ? (
        <VariantSelector
          options={options}
          selected={selected}
          onChange={onOptionChange}
          availability={availability}
        />
      ) : null}

      {customization.isCustomizable ? (
        <ProductConfigurator
          customization={customization}
          value={draft}
          onChange={setDraft}
        />
      ) : null}

      <div>
        <p className="mb-2 text-sm font-medium text-foreground-muted uppercase tracking-wide">
          Qty
        </p>
        <QuantityStepper
          value={quantity}
          onChange={setQuantity}
          label={`Quantity for ${title}`}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Button
          variant="primary"
          size="lg"
          isDisabled={isOutOfStock || missingInputs.length > 0}
          onPress={handleAddToCart}
        >
          Add to cart{totalPrice ? ` · ${totalPrice}` : ""}
        </Button>

        {missingMessage && !isSoldOut ? (
          <p className="text-sm text-foreground-muted">{missingMessage}</p>
        ) : null}
      </div>
    </div>
  );
}
