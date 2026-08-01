import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { Logger, MedusaContainer } from "@medusajs/framework/types";

import { getLabel } from "./label-storage";
import { ORDER_STATUS_MODULE } from "../modules/order-status";
import type OrderStatusModuleService from "../modules/order-status/service";
import { SHIPSTATION_MODULE } from "../modules/shipstation";
import { SHIPSTATION_LABEL_LOG_TAG } from "../modules/shipstation/lib";
import type ShipStationModuleService from "../modules/shipstation/service";

export type LoadedLabels = {
  buffers: Buffer[];
  unavailable: string[];
};

export async function loadLabelBytes(
  scope: MedusaContainer,
  orderIds: readonly string[],
): Promise<LoadedLabels> {
  const service = scope.resolve<OrderStatusModuleService>(ORDER_STATUS_MODULE);
  const logger = scope.resolve<Logger>(ContainerRegistrationKeys.LOGGER);

  const buffers: Buffer[] = [];
  const unavailable: string[] = [];

  for (const orderId of orderIds) {
    try {
      const shipment = await service.activeShipment(orderId);

      if (!shipment) {
        unavailable.push(orderId);
        continue;
      }

      if (shipment.label_file_id) {
        buffers.push(await getLabel(shipment.label_file_id));
        continue;
      }

      if (shipment.label_url?.startsWith("http")) {
        const shipstation =
          scope.resolve<ShipStationModuleService>(SHIPSTATION_MODULE);
        buffers.push(await shipstation.downloadLabelPdf(shipment.label_url));
        continue;
      }

      unavailable.push(orderId);
    } catch (error) {
      logger.warn(
        `${SHIPSTATION_LABEL_LOG_TAG} reason=label_load_failed order=${orderId} error=${error instanceof Error ? error.message : String(error)}`,
      );
      unavailable.push(orderId);
    }
  }

  return { buffers, unavailable };
}
