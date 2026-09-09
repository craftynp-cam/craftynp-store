"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";

import { ProductDetails } from "./product-details";
import { ProductGallery } from "./product-gallery";
import { ProductPurchase } from "./product-purchase";
import type { ProductDetail, ProductDetailOption } from "@/lib/product";
import { findVariant } from "@/lib/variant";

type ProductDetailViewProps = {
  product: ProductDetail;
};

function defaultSelection(
  options: readonly ProductDetailOption[],
): Record<string, string> {
  const selection: Record<string, string> = {};
  for (const option of options) {
    if (option.values.length !== 1) continue;
    const onlyValue = option.values[0];
    if (onlyValue) selection[option.id] = onlyValue.id;
  }
  return selection;
}

export function ProductDetailView({ product }: ProductDetailViewProps) {
  const [selected, setSelected] = useState<Record<string, string>>(() =>
    defaultSelection(product.options),
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
      className="mt-6 grid gap-10 max-lg:pb-[calc(var(--cta-bar-height,7rem)+1rem)] lg:grid-cols-2"
      style={
        ctaHeight == null
          ? undefined
          : ({ "--cta-bar-height": `${ctaHeight}px` } as CSSProperties)
      }
    >
      <ProductGallery
        key={variantImageUrl ?? ""}
        images={product.images}
        productTitle={product.title}
        variantImageUrl={variantImageUrl}
      />

      <div className="flex flex-col gap-8">
        <ProductPurchase
          title={product.title}
          href={product.href}
          imageUrl={variantImageUrl ?? product.images[0]?.url}
          options={product.options}
          variants={product.variants}
          selected={selected}
          onOptionChange={(optionId, valueId) =>
            setSelected((current) => ({ ...current, [optionId]: valueId }))
          }
          onCtaHeightChange={setCtaHeight}
        />
        <ProductDetails description={product.description} />
      </div>
    </div>
  );
}
