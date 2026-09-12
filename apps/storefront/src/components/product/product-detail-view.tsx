"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";
import type { CSSProperties } from "react";

import { ProcessPanel } from "./process-panel";
import { ProductDetails } from "./product-details";
import { ProductGallery } from "./product-gallery";
import { ProductPurchase } from "./product-purchase";
import { readCart, readServerCart, subscribeToCart } from "@/lib/cart";
import { openCartDrawer } from "@/lib/cart-drawer";
import type { ProductDetail } from "@/lib/product";
import { EDIT_LINE_PARAM } from "@/lib/routes";
import {
  EMPTY_CUSTOMIZATION_DRAFT,
  configurationFromCartLine,
  resolveCustomSizeOption,
  usesCustomSize,
  type CartLineConfiguration,
} from "@/lib/product-customization";
import { findVariant } from "@/lib/variant";

type ProductDetailViewProps = {
  product: ProductDetail;
  turnaroundNote: string;
  shippingWindowNote: string;
};

function defaultSelection(product: ProductDetail): Record<string, string> {
  const selection: Record<string, string> = {};
  for (const option of product.options) {
    if (option.values.length !== 1) continue;
    const onlyValue = option.values[0];
    if (onlyValue) selection[option.id] = onlyValue.id;
  }

  const customSize = resolveCustomSizeOption(
    product.options,
    product.customization,
  );
  if (
    customSize &&
    usesCustomSize(product.customization, EMPTY_CUSTOMIZATION_DRAFT)
  ) {
    selection[customSize.option.id] = customSize.customValue.id;
  }

  return selection;
}

export function ProductDetailView({
  product,
  turnaroundNote,
  shippingWindowNote,
}: ProductDetailViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cart = useSyncExternalStore(subscribeToCart, readCart, readServerCart);

  const requestedLineId = searchParams?.get(EDIT_LINE_PARAM) ?? null;
  const editLine = requestedLineId
    ? cart.lines.find((line) => line.lineId === requestedLineId)
    : undefined;
  const configuration = editLine
    ? configurationFromCartLine(editLine, product)
    : null;
  const editLineId = configuration ? requestedLineId : null;

  function settleEdit() {
    router.replace(product.href);
    document.getElementById("main-content")?.focus({ preventScroll: true });
    openCartDrawer();
  }

  return (
    <ProductConfigureView
      key={editLineId ?? "new"}
      product={product}
      turnaroundNote={turnaroundNote}
      shippingWindowNote={shippingWindowNote}
      configuration={configuration}
      editLineId={editLineId ?? undefined}
      onEditSettled={settleEdit}
    />
  );
}

type ProductConfigureViewProps = ProductDetailViewProps & {
  configuration: CartLineConfiguration | null;
  editLineId?: string;
  onEditSettled: () => void;
};

function ProductConfigureView({
  product,
  turnaroundNote,
  shippingWindowNote,
  configuration,
  editLineId,
  onEditSettled,
}: ProductConfigureViewProps) {
  const [selected, setSelected] = useState<Record<string, string>>(
    () => configuration?.selected ?? defaultSelection(product),
  );
  const [ctaHeight, setCtaHeight] = useState<number | null>(null);

  const optionIds = useMemo(
    () => product.options.map((option) => option.id),
    [product.options],
  );

  const selectedVariant = findVariant(product.variants, selected, optionIds);
  const variantImageUrl = selectedVariant?.thumbnail ?? undefined;

  return (
    <div
      className="mt-6 grid gap-10 max-lg:pb-[calc(var(--cta-bar-height,7rem)+1rem)] max-lg:[&_*]:scroll-mb-[calc(var(--cta-bar-height,7rem)+1rem)] lg:grid-cols-2"
      style={
        ctaHeight == null
          ? undefined
          : ({ "--cta-bar-height": `${ctaHeight}px` } as CSSProperties)
      }
    >
      <div className="lg:sticky lg:top-[calc(var(--chrome-height)+1.5rem)] lg:max-h-[calc(100svh-var(--chrome-height)-3rem)] lg:self-start lg:overflow-y-auto">
        <ProductGallery
          key={variantImageUrl ?? ""}
          images={product.images}
          productTitle={product.title}
          variantImageUrl={variantImageUrl}
        />
      </div>

      <div className="flex flex-col gap-8">
        <ProductPurchase
          title={product.title}
          href={product.href}
          imageUrl={variantImageUrl ?? product.images[0]?.url}
          options={product.options}
          variants={product.variants}
          customization={product.customization}
          artworkMinDpi={product.artworkMinDpi}
          minOrderQuantity={product.minOrderQuantity}
          selected={selected}
          onOptionChange={(optionId, valueId) =>
            setSelected((current) => {
              if (valueId === null) {
                const { [optionId]: _removed, ...rest } = current;
                return rest;
              }
              return { ...current, [optionId]: valueId };
            })
          }
          onCtaHeightChange={setCtaHeight}
          initialDraft={configuration?.draft}
          initialQuantity={configuration?.quantity}
          editLineId={editLineId}
          onEditSettled={onEditSettled}
        />
        <ProductDetails description={product.description} />
        <ProcessPanel
          customization={product.customization}
          turnaroundNote={turnaroundNote}
          shippingWindowNote={shippingWindowNote}
        />
      </div>
    </div>
  );
}
