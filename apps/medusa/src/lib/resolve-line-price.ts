import {
  areaUnitPrice,
  checkCustomDimensions,
  resolveProductCustomization,
} from "@craftynp/types";
import type { CustomDimensions } from "@craftynp/types";

import { toAmount, toNullableAmount } from "./money";

export const PRICE_QUOTE_TTL_MS = 30 * 60 * 1000;

export type VariantWithPrice = {
  id: string;
  product?: { metadata?: Record<string, unknown> | null } | null;
  calculated_price?: {
    calculated_amount?: unknown;
    original_amount?: unknown;
    currency_code?: string | null;
  } | null;
};

export type PricedVariantQuery = (input: {
  variantIds: readonly string[];
  quantity: number;
}) => Promise<VariantWithPrice[]>;

export type ResolvedLinePrice = {
  unitAmount: number;
  originalUnitAmount: number | null;
  currencyCode: string;
  isAreaPriced: boolean;
};

export type LinePriceProblem =
  | { ok: true; price: ResolvedLinePrice }
  | {
      ok: false;
      reason:
        "unknown_variant" | "unpriced" | "unconfigured" | "bad_dimensions";
      message: string;
    };

// The one derivation both /store/price-quote and prepare-cart go through, so a
// shopper cannot be shown one number and charged another. Nothing here reads a
// price off the request: the amount comes from Medusa and the rate from the
// product's own metadata.
export async function resolveLinePrice(
  queryPricedVariants: PricedVariantQuery,
  input: {
    variantId: string;
    quantity: number;
    dimensions?: CustomDimensions | null;
  },
): Promise<LinePriceProblem> {
  const [variant] = await queryPricedVariants({
    variantIds: [input.variantId],
    quantity: input.quantity,
  });

  if (!variant) {
    return {
      ok: false,
      reason: "unknown_variant",
      message: `unknown variant ${input.variantId}`,
    };
  }

  const calculated = toNullableAmount(
    variant.calculated_price?.calculated_amount,
  );
  const currencyCode = variant.calculated_price?.currency_code ?? null;

  if (calculated === null || currencyCode === null) {
    return {
      ok: false,
      reason: "unpriced",
      message: `variant ${input.variantId} has no price in this region`,
    };
  }

  const originalUnitAmount = toNullableAmount(
    variant.calculated_price?.original_amount,
  );

  if (!input.dimensions) {
    return {
      ok: true,
      price: {
        unitAmount: calculated,
        originalUnitAmount,
        currencyCode,
        isAreaPriced: false,
      },
    };
  }

  const customization = resolveProductCustomization(variant.product?.metadata);
  const dimensionErrors = checkCustomDimensions(
    input.dimensions,
    customization.size,
  );
  const dimensionProblem =
    dimensionErrors.widthInches ?? dimensionErrors.heightInches;

  // Re-checked here rather than trusted: the storefront holds the shopper to
  // these bounds, but the request is a request.
  if (dimensionProblem) {
    return { ok: false, reason: "bad_dimensions", message: dimensionProblem };
  }

  // The tier the ordered quantity earns, expressed against the single-unit
  // price, so a custom size gets the same volume discount a preset one does.
  // An area-priced line is is_custom_price at the cart, which stops Medusa
  // applying the tier itself.
  const [singleUnit] = await queryPricedVariants({
    variantIds: [input.variantId],
    quantity: 1,
  });
  const singleUnitAmount = toAmount(
    singleUnit?.calculated_price?.calculated_amount,
  );
  const tierRatio = singleUnitAmount > 0 ? calculated / singleUnitAmount : 1;

  const unitAmount = areaUnitPrice({
    variantAmount: singleUnitAmount,
    ratePerSquareInch: customization.size.ratePerSquareInch,
    priceFloor: customization.size.priceFloor,
    widthInches: input.dimensions.widthInches,
    heightInches: input.dimensions.heightInches,
    tierRatio,
  });

  if (unitAmount === null) {
    return {
      ok: false,
      reason: "unconfigured",
      message: `this product has no custom size pricing configured`,
    };
  }

  return {
    ok: true,
    price: {
      unitAmount,
      originalUnitAmount: null,
      currencyCode,
      isAreaPriced: true,
    },
  };
}
