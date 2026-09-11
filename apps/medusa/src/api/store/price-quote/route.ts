import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import {
  ContainerRegistrationKeys,
  QueryContext,
} from "@medusajs/framework/utils";
import type { Logger, RemoteQueryFunction } from "@medusajs/framework/types";
import type { PriceQuoteRequest, PriceQuoteResponse } from "@craftynp/types";

import {
  PRICE_QUOTE_TTL_MS,
  resolveLinePrice,
  type PricedVariantQuery,
  type VariantWithPrice,
} from "../../../lib/resolve-line-price";
import { priceSignature, signPriceQuote } from "../../../lib/price-quote";

export const PRICE_UNAVAILABLE_LOG_TAG = "[price-quote:unavailable]";

const VARIANT_PRICE_FIELDS = [
  "id",
  "product.metadata",
  "calculated_price.calculated_amount",
  "calculated_price.original_amount",
  "calculated_price.currency_code",
];

// The quantity in the pricing context is what makes a price list's min/max
// quantity rules apply. GET /store/products cannot carry it — core builds that
// context from the region and customer groups alone — which is why this route
// exists at all.
export function pricedVariantQuery(
  query: Pick<RemoteQueryFunction, "graph">,
  region: { id: string; currency_code: string },
): PricedVariantQuery {
  return async ({ variantIds, quantity }) => {
    const { data } = await query.graph({
      entity: "variant",
      fields: VARIANT_PRICE_FIELDS,
      filters: { id: [...variantIds] },
      context: {
        calculated_price: QueryContext({
          region_id: region.id,
          currency_code: region.currency_code,
          quantity,
        }),
      },
    });
    return data as VariantWithPrice[];
  };
}

export async function POST(
  req: MedusaRequest<PriceQuoteRequest>,
  res: MedusaResponse,
) {
  const logger = req.scope.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const { variantId, quantity, dimensions } = req.validatedBody;

  let region: { id: string; currency_code: string } | undefined;

  try {
    const { data: regions } = await query.graph({
      entity: "region",
      fields: ["id", "currency_code"],
      filters: {},
    });
    region = regions[0] as { id: string; currency_code: string } | undefined;
  } catch (error) {
    logger.error(
      `${PRICE_UNAVAILABLE_LOG_TAG} reason=misconfigured variant=${variantId} error=${error instanceof Error ? error.message : String(error)}`,
    );
    return res.status(502).json({
      error: "price_unavailable",
      reason: "misconfigured",
      message: "price_unavailable:misconfigured",
    });
  }

  if (!region) {
    logger.error(
      `${PRICE_UNAVAILABLE_LOG_TAG} reason=no_region variant=${variantId}`,
    );
    return res.status(502).json({
      error: "price_unavailable",
      reason: "misconfigured",
      message: "price_unavailable:misconfigured",
    });
  }

  let result: Awaited<ReturnType<typeof resolveLinePrice>>;

  try {
    result = await resolveLinePrice(pricedVariantQuery(query, region), {
      variantId,
      quantity,
      dimensions,
    });
  } catch (error) {
    logger.error(
      `${PRICE_UNAVAILABLE_LOG_TAG} reason=query_failed variant=${variantId} error=${error instanceof Error ? error.message : String(error)}`,
    );
    return res.status(502).json({
      error: "price_unavailable",
      reason: "misconfigured",
      message: "price_unavailable:misconfigured",
    });
  }

  if (!result.ok) {
    if (
      result.reason === "unknown_variant" ||
      result.reason === "bad_dimensions"
    ) {
      return res.status(400).json({
        error: "invalid_line",
        reason: result.reason,
        message: result.message,
      });
    }

    logger.error(
      `${PRICE_UNAVAILABLE_LOG_TAG} reason=${result.reason} variant=${variantId}`,
    );
    return res.status(502).json({
      error: "price_unavailable",
      reason: result.reason,
      message: result.message,
    });
  }

  const { unitAmount, originalUnitAmount, currencyCode, isAreaPriced } =
    result.price;

  const quoteToken = signPriceQuote(
    {
      amt: unitAmount,
      cur: currencyCode,
      ps: priceSignature({
        variantId,
        quantity,
        widthInches: dimensions?.widthInches ?? null,
        heightInches: dimensions?.heightInches ?? null,
      }),
      exp: Date.now() + PRICE_QUOTE_TTL_MS,
    },
    process.env.PRICE_QUOTE_SECRET as string,
  );

  const response: PriceQuoteResponse = {
    unitAmount,
    lineTotal: Math.round(unitAmount * quantity * 100) / 100,
    originalUnitAmount,
    currencyCode,
    isAreaPriced,
    quoteToken,
  };

  return res.json(response);
}
