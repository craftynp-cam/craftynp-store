import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { Logger } from "@medusajs/framework/types";
import type { RateShipmentRequest } from "@craftynp/types";

import { describeInternalFailure, describeLabelFailure } from "@craftynp/types";

import { describeError } from "../../../../../../lib/describe-error";
import {
  buildQueueEntries,
  type OrderRow,
  type VariantDimensions,
} from "../../../../../../lib/fulfilment-queue";
import { toShipStationAddress } from "../../../../../../lib/fulfilment-queue";
import { SHIPSTATION_MODULE } from "../../../../../../modules/shipstation";
import {
  SHIPSTATION_LABEL_LOG_TAG,
  ShipStationLabelError,
} from "../../../../../../modules/shipstation/lib";
import type ShipStationModuleService from "../../../../../../modules/shipstation/service";

const ORDER_FIELDS = [
  "id",
  "display_id",
  "created_at",
  "email",
  "items.*",
  "shipping_address.*",
];

const VARIANT_FIELDS = [
  "id",
  "title",
  "weight",
  "length",
  "width",
  "height",
  "product.title",
  "product.weight",
  "product.length",
  "product.width",
  "product.height",
];

export async function POST(
  req: AuthenticatedMedusaRequest<RateShipmentRequest>,
  res: MedusaResponse,
) {
  const logger = req.scope.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const orderId = req.params.id ?? "";
  const override = req.validatedBody?.parcel ?? null;

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const { data: orders } = await query.graph({
    entity: "order",
    fields: ORDER_FIELDS,
    filters: { id: orderId },
  });

  const order = (orders as OrderRow[])[0];
  if (!order) {
    return res.status(404).json({
      error: "unknown_order",
      reason: "unknown_order",
      message: "We could not find this order.",
    });
  }

  const destination = toShipStationAddress(order.shipping_address);
  if (!destination) {
    return res.status(409).json({
      error: "incomplete_address",
      reason: "incomplete_address",
      message:
        "This order has no complete delivery address, so it cannot be rated.",
    });
  }

  const variantIds = [
    ...new Set(
      (order.items ?? [])
        .map((item) => item.variant_id)
        .filter((id): id is string => typeof id === "string"),
    ),
  ];

  const variantsById = new Map<string, VariantDimensions>();

  if (variantIds.length > 0) {
    const { data: variants } = await query.graph({
      entity: "variant",
      fields: VARIANT_FIELDS,
      filters: { id: variantIds },
    });

    for (const variant of variants as VariantDimensions[]) {
      variantsById.set(variant.id, variant);
    }
  }

  const [entry] = buildQueueEntries([orderId], [order], variantsById);
  const derivedParcel = entry?.derivedParcel ?? null;
  const parcel = override ?? derivedParcel;

  if (!parcel) {
    return res.status(409).json({
      error: "missing_dimensions",
      reason: "missing_dimensions",
      message: `We cannot work out the parcel for this order. Add a weight and size to ${entry?.missingDimensions.join(", ") ?? "these products"}, or enter the parcel by hand.`,
    });
  }

  try {
    const shipstation =
      req.scope.resolve<ShipStationModuleService>(SHIPSTATION_MODULE);

    const rates = await shipstation.getShipmentRates({ destination, parcel });

    return res.json({ rates, parcel, derivedParcel });
  } catch (error) {
    const detail = describeError(error);
    if (!(error instanceof ShipStationLabelError)) {
      const copy = describeInternalFailure(detail);

      return res.status(500).json({
        error: "rates_unavailable",
        reason: "internal_error",
        message: `${copy.title}. ${copy.body} ${copy.nextStep}`,
      });
    }

    const reason = error.reason;
    const carrierMessage = error.carrierMessage;

    logger.warn(
      `${SHIPSTATION_LABEL_LOG_TAG} reason=rates_failed order=${orderId} detail=${reason} carrier_message=${carrierMessage ?? ""} error=${detail}`,
    );

    const copy = describeLabelFailure(reason, carrierMessage);

    return res.status(502).json({
      error: "rates_unavailable",
      reason,
      carrierMessage,
      message: `${copy.title}. ${copy.body} ${copy.nextStep}`,
    });
  }
}
