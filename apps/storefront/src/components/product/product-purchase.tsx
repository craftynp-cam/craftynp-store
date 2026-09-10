"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
  customSizeErrors,
  customizationDetails,
  missingInputLabels,
  missingRequiredInputs,
  resolveCustomSizeOption,
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
  onOptionChange: (optionId: string, valueId: string | null) => void;
  onCtaHeightChange?: (height: number) => void;
};

function joinTitles(titles: readonly string[]): string {
  const last = titles.at(-1);
  if (last == null) return "";
  if (titles.length === 1) return last;
  return `${titles.slice(0, -1).join(", ")} and ${last}`;
}

function asSentence(clauses: readonly string[]): string {
  const joined = clauses.join(", then ");
  return `${joined.charAt(0).toUpperCase()}${joined.slice(1)} to continue.`;
}

export function ProductPurchase({
  title,
  href,
  imageUrl,
  options,
  variants,
  customization,
  selected,
  onOptionChange,
  onCtaHeightChange,
}: ProductPurchaseProps) {
  const [quantity, setQuantity] = useState(1);
  const [draft, setDraft] = useState<CustomizationDraft>(
    EMPTY_CUSTOMIZATION_DRAFT,
  );
  const presetSizeRef = useRef<string | null>(null);
  const ctaRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = ctaRef.current;
    if (!node || !onCtaHeightChange) return;

    const report = () => {
      if (node.offsetHeight > 0) onCtaHeightChange(node.offsetHeight);
    };

    if (typeof ResizeObserver === "undefined") {
      report();
      return;
    }

    const observer = new ResizeObserver(report);
    observer.observe(node);
    return () => observer.disconnect();
  }, [onCtaHeightChange]);

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
    const purchasable = priced.filter(
      (variant) => variant.availability !== "out_of_stock",
    );
    const pool = purchasable.length > 0 ? purchasable : priced;

    const first = pool[0];
    if (!first) return undefined;
    return formatMoney(
      Math.min(...pool.map((variant) => variant.calculatedAmount)),
      first.currencyCode,
    );
  }, [variants]);

  const customSizeOption = useMemo(
    () => resolveCustomSizeOption(options, customization),
    [options, customization],
  );

  function handleCustomSizeChange(useCustomSize: boolean) {
    setDraft((current) => ({ ...current, useCustomSize }));
    if (!customSizeOption) return;

    const { option, customValue } = customSizeOption;
    if (useCustomSize) {
      presetSizeRef.current = selected[option.id] ?? null;
      onOptionChange(option.id, customValue.id);
      return;
    }
    onOptionChange(option.id, presetSizeRef.current);
  }

  const outstanding = options.filter((option) => selected[option.id] == null);
  const missingInputs = missingRequiredInputs(customization, draft);
  const sizeErrors = customSizeErrors(customization, draft);
  const hasSizeErrors = Object.keys(sizeErrors).length > 0;
  const selectedVariant = findVariant(variants, selected, optionIds);
  const isSoldOut = selectedVariant?.availability === "out_of_stock";
  const canAddToCart =
    selectedVariant != null &&
    !isSoldOut &&
    missingInputs.length === 0 &&
    !hasSizeErrors;

  const clauses: string[] = [];
  if (outstanding.length > 0) {
    clauses.push(
      `choose ${joinTitles(outstanding.map((option) => option.title))}`,
    );
  }
  if (missingInputs.length > 0) {
    clauses.push(`add ${joinTitles(missingInputLabels(missingInputs))}`);
  }
  if (hasSizeErrors) {
    clauses.push("check the size you entered");
  }

  const hint = isSoldOut
    ? undefined
    : outstanding.length === 0 && selectedVariant == null
      ? "That combination is not available."
      : clauses.length > 0
        ? asSentence(clauses)
        : undefined;

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
    if (!selectedVariant || !canAddToCart) return;

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

      <VariantSelector
        options={options}
        selected={selected}
        onChange={onOptionChange}
        availability={availability}
        hiddenValueIds={
          customSizeOption
            ? new Set([customSizeOption.customValue.id])
            : undefined
        }
        disabledOptionIds={
          customSizeOption && draft.useCustomSize
            ? new Set([customSizeOption.option.id])
            : undefined
        }
      />

      {customization.isCustomizable ? (
        <ProductConfigurator
          customization={customization}
          value={draft}
          onChange={setDraft}
          sizeErrors={sizeErrors}
          onCustomSizeChange={handleCustomSizeChange}
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

      <div
        ref={ctaRef}
        className="flex flex-col gap-2 max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-40 max-lg:border-t max-lg:border-border max-lg:bg-surface max-lg:p-4"
      >
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
