import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { Logger } from "@medusajs/framework/types";

import { describeError } from "../../../../lib/describe-error";
import {
  buildQueueEntries,
  type OrderRow,
  type VariantDimensions,
} from "../../../../lib/fulfilment-queue";
import { ORDER_STATUS_MODULE } from "../../../../modules/order-status";
import { ORDER_STATUS_LOG_TAG } from "../../../../modules/order-status/lib";
import type OrderStatusModuleService from "../../../../modules/order-status/service";

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

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
) {
  const logger = req.scope.resolve<Logger>(ContainerRegistrationKeys.LOGGER);

  try {
    const service =
      req.scope.resolve<OrderStatusModuleService>(ORDER_STATUS_MODULE);
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

    const records = (await service.listOrderStatusRecords({
      status: "packing",
    })) as { order_id: string }[];

    const orderIds = records.map((record) => record.order_id);
    if (orderIds.length === 0) return res.json({ orders: [] });

    const { data: orders } = await query.graph({
      entity: "order",
      fields: ORDER_FIELDS,
      filters: { id: orderIds },
    });

    const variantIds = [
      ...new Set(
        (orders as OrderRow[]).flatMap((order) =>
          (order.items ?? [])
            .map((item) => item.variant_id)
            .filter((id): id is string => typeof id === "string"),
        ),
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

    return res.json({
      orders: buildQueueEntries(orderIds, orders as OrderRow[], variantsById),
    });
  } catch (error) {
    const detail = describeError(error);
    logger.error(
      `${ORDER_STATUS_LOG_TAG} reason=fulfilment_queue_failed error=${detail}`,
    );

    return res.status(500).json({
      error: "fulfilment_queue_failed",
      reason: "fulfilment_queue_failed",
      message: detail,
    });
  }
}
