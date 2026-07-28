"use client";

import { useMemo, useState } from "react";

import { Badge, Button, QuantityStepper } from "../ui";
import { ProductPrice } from "./product-price";
import { StockStatus } from "./stock-status";
import { VariantSelector } from "./variant-selector";
import { addCartLine } from "@/lib/cart";
import { openCartDrawer } from "@/lib/cart-drawer";
import { formatMoney } from "@/lib/money";
import type { ProductDetailOption, ProductDetailVariant } from "@/lib/product";
import { findVariant, optionValueAvailability } from "@/lib/variant";

type ProductPurchaseProps = {
  title: string;
  href: string;
  imageUrl?: string;
  options: readonly ProductDetailOption[];
  variants: readonly ProductDetailVariant[];
};

function defaultSelection(
  options: readonly ProductDetailOption[],
): Record<string, string> {
  const selection: Record<string, string> = {};
  for (const option of options) {
    const firstValue = option.values[0];
    if (firstValue) selection[option.id] = firstValue.id;
  }
  return selection;
}

export function ProductPurchase({
  title,
  href,
  imageUrl,
  options,
  variants,
}: ProductPurchaseProps) {
  const [selected, setSelected] = useState<Record<string, string>>(() =>
    defaultSelection(options),
  );
  const [quantity, setQuantity] = useState(1);

  const optionIds = useMemo(
    () => options.map((option) => option.id),
    [options],
  );

  const availability = useMemo(
    () => optionValueAvailability(options, variants, selected),
    [options, variants, selected],
  );

  const selectedVariant = findVariant(variants, selected, optionIds);
  const isOutOfStock =
    selectedVariant == null || selectedVariant.availability === "out_of_stock";

  const totalPrice = selectedVariant?.price
    ? formatMoney(
        selectedVariant.calculatedAmount * quantity,
        selectedVariant.currencyCode,
      )
    : undefined;

  const detailsForCart = options
    .map((option) => {
      const valueId = selected[option.id];
      const value = option.values.find((candidate) => candidate.id === valueId);
      return value ? { label: option.title, value: value.value } : undefined;
    })
    .filter((detail) => detail != null);

  function handleAddToCart() {
    if (!selectedVariant) return;

    addCartLine({
      id: selectedVariant.id,
      href,
      title,
      imageUrl,
      imageAlt: title,
      unitPrice: selectedVariant.calculatedAmount,
      currencyCode: selectedVariant.currencyCode,
      quantity,
      isCustomizable: false,
      details: detailsForCart,
    });
    openCartDrawer();
  }

  return (
    <div className="flex flex-col gap-6">
      <Badge
        tone="success"
        variant="primary"
        className="w-fit uppercase tracking-wide"
      >
        Ready to ship
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
          onChange={(optionId, valueId) =>
            setSelected((current) => ({ ...current, [optionId]: valueId }))
          }
          availability={availability}
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

      <Button
        variant="primary"
        size="lg"
        isDisabled={isOutOfStock}
        onPress={handleAddToCart}
      >
        Add to cart{totalPrice ? ` · ${totalPrice}` : ""}
      </Button>
    </div>
  );
}
