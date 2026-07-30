import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { Logger } from "@medusajs/framework/types";
import type { ShippingRateRequest } from "@craftynp/types";

import { SHIPSTATION_MODULE } from "../../../modules/shipstation";
import {
  SHIPSTATION_UNAVAILABLE_LOG_TAG,
  ShipStationRateError,
  packItemsIntoOneBox,
  type NormalizedRate,
} from "../../../modules/shipstation/lib";
import type ShipStationModuleService from "../../../modules/shipstation/service";
import { cartSignature, signShippingQuote } from "../../../lib/shipping-quote";

type VariantWithDimensions = {
  id: string;
  weight: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
  product?: {
    weight: number | null;
    length: number | null;
    width: number | null;
    height: number | null;
  } | null;
};

export async function POST(
  req: MedusaRequest<ShippingRateRequest>,
  res: MedusaResponse,
) {
  const logger = req.scope.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const shipstation =
    req.scope.resolve<ShipStationModuleService>(SHIPSTATION_MODULE);

  const { destination, items } = req.validatedBody;
  const variantIds = items.map((item) => item.variantId);

  const { data: variants } = await query.graph({
    entity: "variant",
    fields: [
      "id",
      "weight",
      "length",
      "width",
      "height",
      "product.weight",
      "product.length",
      "product.width",
      "product.height",
    ],
    filters: { id: variantIds },
  });

  const variantsById = new Map(
    (variants as VariantWithDimensions[]).map((variant) => [
      variant.id,
      variant,
    ]),
  );

  const unknownVariantIds = variantIds.filter((id) => !variantsById.has(id));
  if (unknownVariantIds.length > 0) {
    return res.status(400).json({
      error: "unknown_variant",
      variantIds: unknownVariantIds,
    });
  }

  const packableItems = items.map((item) => {
    const variant = variantsById.get(item.variantId);
    return {
      variantId: item.variantId,
      quantity: item.quantity,
      weight: variant?.weight ?? variant?.product?.weight,
      length: variant?.length ?? variant?.product?.length,
      width: variant?.width ?? variant?.product?.width,
      height: variant?.height ?? variant?.product?.height,
    };
  });

  const packed = packItemsIntoOneBox(packableItems);

  if (!packed.ok) {
    logger.error(
      `${SHIPSTATION_UNAVAILABLE_LOG_TAG} reason=missing_dimensions variants=${packed.missing.join(",")} postal=${destination.postalCode}`,
    );
    return res.status(502).json({
      error: "shipping_unavailable",
      reason: "missing_dimensions",
    });
  }

  const cartSig = cartSignature({
    items,
    postalCode: destination.postalCode,
    countryCode: destination.countryCode,
  });
  const secret = process.env.SHIPPING_QUOTE_SECRET as string;
  const expiryMs = Date.now() + 30 * 60_000;

  function signRate(rate: NormalizedRate) {
    const quoteToken = signShippingQuote(
      {
        rid: rate.rateId,
        amt: rate.amount,
        cur: rate.currencyCode,
        svc: rate.serviceCode,
        car: rate.carrierName,
        cs: cartSig,
        exp: expiryMs,
      },
      secret,
    );

    return { ...rate, quoteToken };
  }

  const startedAt = Date.now();

  try {
    const rates = await shipstation.getUspsRates({
      destination,
      parcel: packed.parcel,
    });

    return res.json({ rates: rates.map(signRate) });
  } catch (error) {
    const reason =
      error instanceof ShipStationRateError ? error.reason : "http_error";
    logger.error(
      `${SHIPSTATION_UNAVAILABLE_LOG_TAG} reason=${reason} postal=${destination.postalCode} weight_g=${packed.parcel.weight} duration_ms=${Date.now() - startedAt}`,
    );
    return res.status(502).json({ error: "shipping_unavailable", reason });
  }
}
