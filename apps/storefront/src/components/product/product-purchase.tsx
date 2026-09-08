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
  selected: Record<string, string>;
  onOptionChange: (optionId: string, valueId: string) => void;
};

function joinTitles(titles: readonly string[]): string {
  const last = titles.at(-1);
  if (last == null) return "";
  if (titles.length === 1) return last;
  return `${titles.slice(0, -1).join(", ")} and ${last}`;
}

export function ProductPurchase({
  title,
  href,
  imageUrl,
  options,
  variants,
  selected,
  onOptionChange,
}: ProductPurchaseProps) {
  const [quantity, setQuantity] = useState(1);

  const optionIds = useMemo(
    () => options.map((option) => option.id),
    [options],
  );

  const availability = useMemo(
    () => optionValueAvailability(options, variants, selected),
    [options, variants, selected],
  );

  const fromPrice = useMemo(() => {
    const priced = variants.filter((variant) => variant.price !== "");
    const first = priced[0];
    if (!first) return undefined;
    return formatMoney(
      Math.min(...priced.map((variant) => variant.calculatedAmount)),
      first.currencyCode,
    );
  }, [variants]);

  const outstanding = options.filter((option) => selected[option.id] == null);
  const selectedVariant = findVariant(variants, selected, optionIds);
  const canAddToCart =
    selectedVariant != null && selectedVariant.availability !== "out_of_stock";

  const hint =
    outstanding.length > 0
      ? `Choose ${joinTitles(outstanding.map((option) => option.title))} to continue.`
      : selectedVariant == null
        ? "That combination is not available."
        : undefined;

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

      {selectedVariant ? (
        <ProductPrice
          price={selectedVariant.price}
          originalPrice={selectedVariant.originalPrice}
          savingsLabel={selectedVariant.savingsLabel}
        />
      ) : fromPrice ? (
        <ProductPrice price={fromPrice} prefix="From" />
      ) : null}

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

      <div className="flex flex-col gap-2 max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-40 max-lg:border-t max-lg:border-border max-lg:bg-surface max-lg:p-4">
        {hint ? <p className="text-sm text-foreground-muted">{hint}</p> : null}

        <Button
          variant="primary"
          size="lg"
          isDisabled={!canAddToCart}
          onPress={handleAddToCart}
        >
          Add to cart{totalPrice ? ` · ${totalPrice}` : ""}
        </Button>
      </div>
    </div>
  );
}
