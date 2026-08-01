import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { Logger } from "@medusajs/framework/types";

import { describeError } from "../../../../lib/describe-error";
import {
  PRINTABLE_WINDOW_DAYS,
  buildPrintableLabels,
  buildQueueEntries,
  type OrderRow,
  type PrintableRow,
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

type ShipmentRow = {
  order_status_id: string;
  tracking_number: string;
  carrier_code: string | null;
  label_file_id: string | null;
  shipped_at: Date | string | null;
};

async function loadPrintableRows(
  service: OrderStatusModuleService,
): Promise<PrintableRow[]> {
  const shippedRecords = (await service.listOrderStatusRecords({
    status: "shipped",
  })) as { id: string; order_id: string }[];

  if (shippedRecords.length === 0) return [];

  const orderIdByStatusId = new Map(
    shippedRecords.map((record) => [record.id, record.order_id]),
  );

  const shipments = (await service.listShipmentTrackings({
    order_status_id: [...orderIdByStatusId.keys()],
    voided_at: null,
  })) as ShipmentRow[];

  const cutoff = Date.now() - PRINTABLE_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  return shipments.flatMap((shipment) => {
    if (!shipment.label_file_id) return [];

    const orderId = orderIdByStatusId.get(shipment.order_status_id);
    if (!orderId) return [];

    if (shipment.shipped_at) {
      const shippedMs = new Date(shipment.shipped_at).getTime();
      if (!Number.isNaN(shippedMs) && shippedMs < cutoff) return [];
    }

    return [
      {
        orderId,
        trackingNumber: shipment.tracking_number,
        carrierCode: shipment.carrier_code,
        shippedAt: shipment.shipped_at,
      },
    ];
  });
}

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

    const printableRows = await loadPrintableRows(service);

    const orderIds = records.map((record) => record.order_id);
    const allIds = [
      ...new Set([...orderIds, ...printableRows.map((row) => row.orderId)]),
    ];

    if (allIds.length === 0) return res.json({ orders: [], printable: [] });

    const { data: orders } = await query.graph({
      entity: "order",
      fields: ORDER_FIELDS,
      filters: { id: allIds },
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
      printable: buildPrintableLabels(printableRows, orders as OrderRow[]),
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
