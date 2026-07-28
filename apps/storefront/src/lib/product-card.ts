import type { ProductCardData } from "@/components";

import { formatMoney } from "./money";
import { productHref } from "./routes";

/**
 * A narrow structural type rather than the SDK's generated product type, so
 * this stays testable without a live backend and only names the fields it
 * actually reads.
 */
export type ProductCardSourceProduct = {
  handle: string | null;
  title: string;
  thumbnail?: string | null;
  categories?: readonly { name: string; handle: string }[] | null;
  variants?:
    | readonly {
        calculated_price?: {
          calculated_amount: number;
          original_amount: number;
          currency_code: string;
        } | null;
      }[]
    | null;
};

/**
 * Maps a Medusa store product onto the card's presentational props: the
 * lowest variant price (marked "from" when variants disagree), sale detection
 * against each variant's original amount, and the first category name.
 */
export function toProductCardProps(
  product: ProductCardSourceProduct,
): ProductCardData {
  const prices = (product.variants ?? [])
    .map((variant) => variant.calculated_price)
    .filter((price) => price != null);

  const cheapest = prices.reduce<(typeof prices)[number] | undefined>(
    (lowest, price) =>
      !lowest || price.calculated_amount < lowest.calculated_amount
        ? price
        : lowest,
    undefined,
  );

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
    // Release 1 has only ready-to-ship products (see CNP-28's release note);
    // the configurator that produces customizable products ships in Release 3.
    isCustomizable: false,
  };
}
