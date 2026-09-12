"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { ProductCustomization } from "@craftynp/types";

import { Badge, Button, QuantityStepper } from "../ui";
import { ProductConfigurator } from "./product-configurator";
import { ProductPrice } from "./product-price";
import { StockStatus } from "./stock-status";
import { usePriceQuote } from "./use-price-quote";
import { VariantSelector } from "./variant-selector";
import { addCartLine } from "@/lib/cart";
import { openCartDrawer } from "@/lib/cart-drawer";
import { formatMoney } from "@/lib/money";
import { quotedDimensions } from "@/lib/price-quote";
import type { ProductDetailOption, ProductDetailVariant } from "@/lib/product";
import {
  EMPTY_CUSTOMIZATION_DRAFT,
  artworkGuidance,
  artworkResolutionError,
  customSizeErrors,
  customTextProblem,
  customizationDetails,
  joinLabels,
  lineItemCustomization,
  missingInputLabels,
  missingRequiredInputs,
  orderNotesProblem,
  orderedSizeInches,
  resolveCustomSizeOption,
  usesCustomSize,
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
  artworkMinDpi: number;
  minOrderQuantity: number;
  selected: Record<string, string>;
  onOptionChange: (optionId: string, valueId: string | null) => void;
  onCtaHeightChange?: (height: number) => void;
};

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
  artworkMinDpi,
  minOrderQuantity,
  selected,
  onOptionChange,
  onCtaHeightChange,
}: ProductPurchaseProps) {
  const [quantity, setQuantity] = useState(minOrderQuantity);
  const orderQuantity = Math.max(quantity, minOrderQuantity);
  const [draft, setDraft] = useState<CustomizationDraft>(
    EMPTY_CUSTOMIZATION_DRAFT,
  );
  const [addError, setAddError] = useState<string | null>(null);
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
  const orderedSize = orderedSizeInches(
    customization,
    draft,
    options,
    selected,
  );
  const artworkError = artworkResolutionError(
    draft,
    artworkMinDpi,
    orderedSize,
  );
  const textProblem = customTextProblem(customization, draft);
  const notesProblem = orderNotesProblem(customization, draft);
  const selectedVariant = findVariant(variants, selected, optionIds);
  const isSoldOut = selectedVariant?.availability === "out_of_stock";

  const quoteDimensions = quotedDimensions(
    usesCustomSize(customization, draft),
    orderedSize,
  );
  // Nothing is quoted while a size is still being typed or is out of range —
  // the backend would only refuse it, and the shopper is already being told.
  const quotableVariantId =
    selectedVariant != null &&
    !isSoldOut &&
    !hasSizeErrors &&
    (!usesCustomSize(customization, draft) || quoteDimensions != null)
      ? selectedVariant.id
      : null;

  const priceQuote = usePriceQuote(
    quotableVariantId,
    orderQuantity,
    quoteDimensions,
  );

  const canAddToCart =
    selectedVariant != null &&
    !isSoldOut &&
    missingInputs.length === 0 &&
    !hasSizeErrors &&
    textProblem === null &&
    notesProblem === null &&
    artworkError === null &&
    priceQuote.status === "ready" &&
    priceQuote.quote !== null;

  const clauses: string[] = [];
  if (outstanding.length > 0) {
    clauses.push(
      `choose ${joinLabels(outstanding.map((option) => option.title))}`,
    );
  }
  if (missingInputs.length > 0) {
    clauses.push(`add ${joinLabels(missingInputLabels(missingInputs))}`);
  }
  if (textProblem !== null) {
    clauses.push(textProblem.clause);
  }
  if (notesProblem !== null) {
    clauses.push(notesProblem.clause);
  }
  if (hasSizeErrors) {
    clauses.push("check the size you entered");
  }
  if (artworkError !== null) {
    clauses.push("replace your artwork with a higher-resolution file");
  }
  // Only the failure earns a clause. A quote in flight is already shown by the
  // price dimming itself, and a hint that appears and vanishes within a second
  // of every option change is noise rather than instruction.
  if (clauses.length === 0 && priceQuote.status === "error") {
    clauses.push("try again — we could not price this just now");
  }

  const hint = isSoldOut
    ? undefined
    : outstanding.length === 0 && selectedVariant == null
      ? "That combination is not available."
      : clauses.length > 0
        ? asSentence(clauses)
        : undefined;

  const quote = priceQuote.quote;
  const quotedUnitPrice = quote
    ? formatMoney(quote.unitAmount, quote.currencyCode)
    : undefined;
  const totalPrice = quote
    ? formatMoney(quote.lineTotal, quote.currencyCode)
    : undefined;

  const detailsForCart = [
    ...options
      .filter(
        (option) =>
          !(
            usesCustomSize(customization, draft) &&
            option.id === customSizeOption?.option.id
          ),
      )
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
    if (!selectedVariant || !canAddToCart || !quote) return;

    const added = addCartLine({
      id: selectedVariant.id,
      href,
      title,
      imageUrl,
      imageAlt: title,
      unitPrice: quote.unitAmount,
      currencyCode: quote.currencyCode,
      quantity: orderQuantity,
      minOrderQuantity,
      isCustomizable: customization.isCustomizable,
      details: detailsForCart,
      dimensions: quoteDimensions,
      priceQuoteToken: quote.quoteToken,
      customization: lineItemCustomization(customization, draft),
    });

    if (!added) {
      setAddError(
        "We could not save this to your cart. Your browser may be out of storage or blocking site data.",
      );
      return;
    }

    setAddError(null);
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
        <>
          <ProductPrice
            price={quotedUnitPrice ?? selectedVariant.price}
            originalPrice={
              quote?.isAreaPriced ? undefined : selectedVariant.originalPrice
            }
            savingsLabel={
              quote?.isAreaPriced ? undefined : selectedVariant.savingsLabel
            }
            lineTotal={totalPrice}
            quantity={orderQuantity}
            isUpdating={priceQuote.status === "loading"}
          />
          {/* Speaks the settled price once. A live region wired to the quote
              itself would read every intermediate figure aloud. */}
          <p role="status" className="sr-only">
            {priceQuote.status === "ready" && totalPrice
              ? `Price updated: ${totalPrice}`
              : ""}
          </p>
        </>
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
          customSizeOption && usesCustomSize(customization, draft)
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
          artworkError={artworkError}
          artworkGuidance={artworkGuidance(artworkMinDpi, orderedSize)}
          customTextError={textProblem?.message ?? null}
          orderNotesError={notesProblem?.message ?? null}
        />
      ) : null}

      <div>
        <p className="mb-2 text-sm font-medium text-foreground-muted uppercase tracking-wide">
          Qty
        </p>
        <QuantityStepper
          value={orderQuantity}
          onChange={setQuantity}
          min={minOrderQuantity}
          label={`Quantity for ${title}`}
          description={
            minOrderQuantity > 1
              ? `Minimum order: ${minOrderQuantity}`
              : undefined
          }
        />
      </div>

      <div
        ref={ctaRef}
        className="flex flex-col gap-2 max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-40 max-lg:border-t max-lg:border-border max-lg:bg-surface max-lg:p-4"
      >
        {hint ? <p className="text-sm text-foreground-muted">{hint}</p> : null}

        {addError ? (
          <p role="alert" className="text-sm text-danger-foreground">
            {addError}
          </p>
        ) : null}

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
