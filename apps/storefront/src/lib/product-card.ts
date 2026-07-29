import type { ProductCardData } from "@/components";

import { formatMoney } from "./money";
import { productHref } from "./routes";

export type ProductCardSourceProduct = {
  handle: string | null;
  title: string;
  thumbnail?: string | null;
  categories?: readonly { name: string; handle: string }[] | null;
  variants?:
    | readonly {
        calculated_price?: {
          calculated_amount: number | null;
          original_amount: number | null;
          currency_code: string | null;
        } | null;
      }[]
    | null;
};

export type CalculatedPrice = {
  calculated_amount: number;
  original_amount: number;
  currency_code: string;
};

export function cheapestPrice(
  product: ProductCardSourceProduct,
): CalculatedPrice | null {
  const prices = (product.variants ?? [])
    .map((variant) => variant.calculated_price)
    .filter(
      (price): price is CalculatedPrice =>
        price != null &&
        price.calculated_amount != null &&
        price.original_amount != null &&
        price.currency_code != null,
    );

  return (
    prices.reduce<CalculatedPrice | undefined>(
      (lowest, price) =>
        !lowest || price.calculated_amount < lowest.calculated_amount
          ? price
          : lowest,
      undefined,
    ) ?? null
  );
}

export function toProductCardProps(
  product: ProductCardSourceProduct,
): ProductCardData {
  const prices = (product.variants ?? [])
    .map((variant) => variant.calculated_price)
    .filter(
      (price): price is CalculatedPrice =>
        price != null &&
        price.calculated_amount != null &&
        price.original_amount != null &&
        price.currency_code != null,
    );

  const cheapest = cheapestPrice(product);

  const isFromPrice =
    new Set(prices.map((price) => price.calculated_amount)).size > 1;

  const isOnSale =
    cheapest != null && cheapest.calculated_amount < cheapest.original_amount;

  return {
    href: productHref(
      product.categories?.[0]?.handle ?? "",
      product.handle ?? "",
    ),
    title: product.title,
    category: product.categories?.[0]?.name ?? "",
    imageUrl: product.thumbnail ?? undefined,
    imageAlt: product.title,
    price: cheapest
      ? formatMoney(cheapest.calculated_amount, cheapest.currency_code)
      : "",
    originalPrice:
      isOnSale && cheapest
        ? formatMoney(cheapest.original_amount, cheapest.currency_code)
        : undefined,
    isFromPrice,
    isCustomizable: false,
  };
}
