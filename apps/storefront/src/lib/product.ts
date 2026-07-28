import { cache } from "react";

import { formatMoney } from "./money";
import { productHref } from "./routes";
import { sdk } from "./medusa";
import { variantAvailability, type Availability } from "./variant";

export type ProductDetailSourceVariant = {
  id: string;
  title: string | null;
  sku?: string | null;
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
  categories?: readonly { name: string; handle: string }[] | null;
  images?: readonly { url: string }[] | null;
  options?:
    | readonly {
        id: string;
        title: string;
        values?: readonly { id: string; value: string }[] | null;
      }[]
    | null;
  variants?: readonly ProductDetailSourceVariant[] | null;
};

export type ProductDetailImage = { url: string; alt: string };

export type ProductDetailOptionValue = { id: string; value: string };

export type ProductDetailOption = {
  id: string;
  title: string;
  values: ProductDetailOptionValue[];
};

export type ProductDetailVariant = {
  id: string;
  sku: string | null;
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
};

export function toProductDetail(
  product: ProductDetailSourceProduct,
): ProductDetail {
  const category = product.categories?.[0];
  const categoryHandle = category?.handle ?? "";
  const productHandleValue = product.handle ?? "";

  const images: ProductDetailImage[] = (product.images ?? []).map(
    (image) => ({ url: image.url, alt: product.title }),
  );
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
          "*variants.calculated_price,+variants.inventory_quantity,*variants.options,*options.values,*images,*categories",
      });

      const product = products[0];
      return product ? toProductDetail(product) : null;
    } catch (error) {
      console.error(`Could not load product "${handle}"`, error);
      return null;
    }
  },
);
