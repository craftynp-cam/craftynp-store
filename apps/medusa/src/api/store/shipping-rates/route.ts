import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { ShippingRateRequest } from "@craftynp/types";

import { SITE_CONTENT_MODULE } from "../../../modules/site-content";
import type SiteContentModuleService from "../../../modules/site-content/service";
import {
  flatShippingRate,
  loadFlatShippingAmount,
} from "../../../lib/flat-shipping";
import { cartSignature, signShippingQuote } from "../../../lib/shipping-quote";

export async function POST(
  req: MedusaRequest<ShippingRateRequest>,
  res: MedusaResponse,
) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const siteContent =
    req.scope.resolve<SiteContentModuleService>(SITE_CONTENT_MODULE);

  const { destination, items } = req.validatedBody;
  const variantIds = items.map((item) => item.variantId);

  const { data: variants } = await query.graph({
    entity: "variant",
    fields: ["id"],
    filters: { id: variantIds },
  });

  const knownIds = new Set((variants as { id: string }[]).map((v) => v.id));
  const unknownVariantIds = variantIds.filter((id) => !knownIds.has(id));
  if (unknownVariantIds.length > 0) {
    return res.status(400).json({
      error: "unknown_variant",
      variantIds: unknownVariantIds,
    });
  }

  const rate = flatShippingRate(await loadFlatShippingAmount(siteContent));

  const quoteToken = signShippingQuote(
    {
      rid: rate.rateId,
      amt: rate.amount,
      cur: rate.currencyCode,
      svc: rate.serviceCode,
      car: rate.carrierName,
      cs: cartSignature({
        items,
        postalCode: destination.postalCode,
        countryCode: destination.countryCode,
      }),
      exp: Date.now() + 30 * 60_000,
    },
    process.env.SHIPPING_QUOTE_SECRET as string,
  );

  return res.json({ rates: [{ ...rate, quoteToken }] });
}
