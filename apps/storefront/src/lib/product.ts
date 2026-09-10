import { cache } from "react";

import {
  readOptionValueWidthInches,
  resolveArtworkMinDpi,
  resolveProductCustomization,
  type ProductCustomization,
} from "@craftynp/types";

import { formatMoney } from "./money";
import { productHref } from "./routes";
import { sdk } from "./medusa";
import { isBackendFailure, MedusaUnavailableError } from "./medusa-error";
import { variantAvailability, type Availability } from "./variant";

export type ProductDetailSourceVariant = {
  id: string;
  title: string | null;
  sku?: string | null;
  thumbnail?: string | null;
  allow_backorder?: boolean | null;
  manage_inventory?: boolean | null;
  inventory_quantity?: number | null;
  options?: readonly { id: string; option_id?: string | null }[] | null;
  calculated_price?: {
    calculated_amount: number | null;
    original_amount: number | null;
    currency_code: string | null;
  } | null;
};

export type ProductDetailSourceProduct = {
  id: string;
  handle: string | null;
  title: string;
  description?: string | null;
  thumbnail?: string | null;
  metadata?: Record<string, unknown> | null;
  categories?:
    | readonly {
        name: string;
        handle: string;
        metadata?: Record<string, unknown> | null;
      }[]
    | null;
  images?: readonly { url: string }[] | null;
  options?:
    | readonly {
        id: string;
        title: string;
        values?:
          | readonly {
              id: string;
              value: string;
              metadata?: Record<string, unknown> | null;
            }[]
          | null;
      }[]
    | null;
  variants?: readonly ProductDetailSourceVariant[] | null;
};

export type ProductDetailImage = { url: string; alt: string };

export type ProductDetailOptionValue = {
  id: string;
  value: string;
  subLabel?: string;
  // How wide the finished piece is at this preset, when the owner has said.
  // Without it there is no ordered width to check an upload's resolution
  // against, so the preset gets guidance rather than a gate.
  widthInches?: number;
};

export type ProductDetailOption = {
  id: string;
  title: string;
  values: ProductDetailOptionValue[];
};

export type ProductDetailVariant = {
  id: string;
  sku: string | null;
  thumbnail: string | null;
  optionValueIds: string[];
  availability: Availability;
  price: string;
  originalPrice?: string;
  savingsLabel?: string;
  calculatedAmount: number;
  currencyCode: string;
};

export type ProductDetail = {
  id: string;
  href: string;
  title: string;
  description: string;
  categoryName: string;
  categoryHandle: string;
  images: ProductDetailImage[];
  options: ProductDetailOption[];
  variants: ProductDetailVariant[];
  customization: ProductCustomization;
  artworkMinDpi: number;
};

const SUB_LABEL_KEYS = ["subLabel", "sub_label"] as const;

function optionValueSubLabel(
  metadata: Record<string, unknown> | null | undefined,
): string | undefined {
  if (!metadata) return undefined;

  for (const key of SUB_LABEL_KEYS) {
    const candidate = metadata[key];
    if (typeof candidate === "string" && candidate.trim() !== "") {
      return candidate.trim();
    }
  }

  return undefined;
}

export function toProductDetail(
  product: ProductDetailSourceProduct,
): ProductDetail {
  const category = product.categories?.[0];
  const categoryHandle = category?.handle ?? "";
  const productHandleValue = product.handle ?? "";

  const images: ProductDetailImage[] = (product.images ?? []).map((image) => ({
    url: image.url,
    alt: product.title,
  }));
  if (images.length === 0 && product.thumbnail) {
    images.push({ url: product.thumbnail, alt: product.title });
  }

  const options: ProductDetailOption[] = (product.options ?? []).map(
    (option) => ({
      id: option.id,
      title: option.title,
      values: (option.values ?? []).map((value) => ({
        id: value.id,
        value: value.value,
        subLabel: optionValueSubLabel(value.metadata),
        widthInches: readOptionValueWidthInches(value.metadata) ?? undefined,
      })),
    }),
  );

  const variants: ProductDetailVariant[] = (product.variants ?? []).map(
    (variant) => {
      const price = variant.calculated_price;
      const calculatedAmount = price?.calculated_amount ?? null;
      const originalAmount = price?.original_amount ?? null;
      const currencyCode = price?.currency_code ?? "usd";
      const isOnSale =
        calculatedAmount != null &&
        originalAmount != null &&
        calculatedAmount < originalAmount;

      return {
        id: variant.id,
        sku: variant.sku ?? null,
        thumbnail: variant.thumbnail ?? null,
        optionValueIds: (variant.options ?? []).map((option) => option.id),
        availability: variantAvailability(variant),
        price:
          calculatedAmount != null
            ? formatMoney(calculatedAmount, currencyCode)
            : "",
        originalPrice:
          isOnSale && originalAmount != null
            ? formatMoney(originalAmount, currencyCode)
            : undefined,
        savingsLabel:
          isOnSale && originalAmount != null && originalAmount > 0
            ? `Save ${Math.round((1 - calculatedAmount / originalAmount) * 100)}%`
            : undefined,
        calculatedAmount: calculatedAmount ?? 0,
        currencyCode,
      };
    },
  );

  return {
    id: product.id,
    href: productHref(categoryHandle, productHandleValue),
    title: product.title,
    description: product.description ?? "",
    categoryName: category?.name ?? "",
    categoryHandle,
    images,
    options,
    variants,
    customization: resolveProductCustomization(product.metadata),
    artworkMinDpi: resolveArtworkMinDpi(product.categories),
  };
}

export const fetchProductByHandle = cache(
  async (
    handle: string,
    regionId: string | undefined,
  ): Promise<ProductDetail | null> => {
    try {
      const { products } = await sdk.store.product.list({
        handle,
        region_id: regionId,
        limit: 1,
        fields:
          "*variants.calculated_price,+variants.inventory_quantity,+variants.thumbnail,*variants.options,*options.values,*images,*categories,+metadata",
      });

      const product = products[0];
      return product ? toProductDetail(product) : null;
    } catch (error) {
      if (isBackendFailure(error)) {
        throw new MedusaUnavailableError(`the product "${handle}"`, error);
      }
      console.error(`Could not load product "${handle}"`, error);
      return null;
    }
  },
);
