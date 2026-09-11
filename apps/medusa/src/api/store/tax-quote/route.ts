import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { Logger } from "@medusajs/framework/types";
import type { TaxQuoteRequest } from "@craftynp/types";

import { STRIPE_TAX_MODULE } from "../../../modules/stripe-tax";
import {
  STRIPE_TAX_UNAVAILABLE_LOG_TAG,
  StripeTaxError,
} from "../../../modules/stripe-tax/lib";
import type StripeTaxModuleService from "../../../modules/stripe-tax/service";
import {
  cartSignature,
  verifyShippingQuote,
} from "../../../lib/shipping-quote";
import { signTaxQuote, taxSignature } from "../../../lib/tax-quote";
import { resolveLinePrice } from "../../../lib/resolve-line-price";
import { pricedVariantQuery } from "../price-quote/route";

type Region = { id: string; currency_code: string };

type RegionWithCountries = {
  id: string;
  currency_code: string;
  countries?: ({ iso_2: string | null } | null)[] | null;
};

function selectRegionForCountry(
  regions: readonly RegionWithCountries[],
  countryCode: string,
): RegionWithCountries | null {
  const wanted = countryCode.toLowerCase();
  const match = regions.find((region) =>
    region.countries?.some(
      (country) => country?.iso_2?.toLowerCase() === wanted,
    ),
  );
  return match ?? regions[0] ?? null;
}

export async function POST(
  req: MedusaRequest<TaxQuoteRequest>,
  res: MedusaResponse,
) {
  const logger = req.scope.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const stripeTax =
    req.scope.resolve<StripeTaxModuleService>(STRIPE_TAX_MODULE);

  const { destination, items, shippingQuoteToken } = req.validatedBody;

  const shippingCartSig = cartSignature({
    items,
    postalCode: destination.postalCode,
    countryCode: destination.countryCode,
  });
  const shippingSecret = process.env.SHIPPING_QUOTE_SECRET as string;
  const shippingResult = verifyShippingQuote(
    shippingQuoteToken,
    shippingSecret,
    { cartSignature: shippingCartSig },
  );

  if (!shippingResult.valid) {
    return res.status(400).json({
      error: "invalid_shipping_quote",
      reason: shippingResult.reason,
    });
  }

  let region: RegionWithCountries | null;
  let priced: Awaited<ReturnType<typeof resolveLinePrice>>[];

  try {
    const { data: regions } = await query.graph({
      entity: "region",
      fields: ["id", "currency_code", "countries.iso_2"],
      filters: {},
    });

    region = selectRegionForCountry(
      regions as RegionWithCountries[],
      destination.countryCode,
    );

    if (!region) {
      logger.error(
        `${STRIPE_TAX_UNAVAILABLE_LOG_TAG} reason=no_region postal=${destination.postalCode}`,
      );
      return res
        .status(502)
        .json({ error: "tax_unavailable", reason: "misconfigured" });
    }

    priced = await Promise.all(
      items.map((item) =>
        resolveLinePrice(pricedVariantQuery(query, region as Region), {
          variantId: item.variantId,
          quantity: item.quantity,
          dimensions: item.dimensions,
        }),
      ),
    );
  } catch (error) {
    logger.error(
      `${STRIPE_TAX_UNAVAILABLE_LOG_TAG} reason=misconfigured postal=${destination.postalCode} error=${error instanceof Error ? error.message : String(error)}`,
    );
    return res
      .status(502)
      .json({ error: "tax_unavailable", reason: "misconfigured" });
  }

  const unknownVariantIds = items
    .filter((item, index) => {
      const result = priced[index];
      return result && !result.ok && result.reason === "unknown_variant";
    })
    .map((item) => item.variantId);

  if (unknownVariantIds.length > 0) {
    return res.status(400).json({
      error: "unknown_variant",
      variantIds: unknownVariantIds,
      message: `unknown_variant:${unknownVariantIds.join(",")}`,
    });
  }

  const unpricedIds = items
    .filter((_item, index) => priced[index]?.ok !== true)
    .map((item) => item.variantId);

  if (unpricedIds.length > 0) {
    logger.error(
      `${STRIPE_TAX_UNAVAILABLE_LOG_TAG} reason=missing_price variants=${unpricedIds.join(",")} postal=${destination.postalCode}`,
    );
    return res
      .status(502)
      .json({ error: "tax_unavailable", reason: "misconfigured" });
  }

  const lineItems = items.map((item, index) => {
    const result = priced[index];
    return {
      reference: item.variantId,
      amount: result?.ok ? result.price.unitAmount : 0,
      quantity: item.quantity,
    };
  });

  const startedAt = Date.now();

  try {
    const calculation = await stripeTax.calculateTax({
      currencyCode: region.currency_code,
      destination,
      lineItems,
      shippingAmount: shippingResult.payload.amt,
    });

    const quoteToken = signTaxQuote(
      {
        cid: calculation.calculationId,
        amt: calculation.taxAmount,
        cur: calculation.currencyCode,
        ts: taxSignature({
          items,
          postalCode: destination.postalCode,
          countryCode: destination.countryCode,
          state: destination.state,
          city: destination.city,
          shippingAmount: shippingResult.payload.amt,
        }),
        exp: Date.now() + 30 * 60_000,
      },
      process.env.TAX_QUOTE_SECRET as string,
    );

    return res.json({
      taxAmount: calculation.taxAmount,
      currencyCode: calculation.currencyCode,
      quoteToken,
    });
  } catch (error) {
    const reason =
      error instanceof StripeTaxError ? error.reason : "http_error";
    const status = reason === "invalid_address" ? 400 : 502;

    logger.error(
      `${STRIPE_TAX_UNAVAILABLE_LOG_TAG} reason=${reason} postal=${destination.postalCode} duration_ms=${Date.now() - startedAt}`,
    );

    if (status === 400) {
      return res.status(400).json({ error: "invalid_address" });
    }
    return res.status(502).json({ error: "tax_unavailable", reason });
  }
}
