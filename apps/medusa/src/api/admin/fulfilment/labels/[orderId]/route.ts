import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import type { IFileModuleService, Logger } from "@medusajs/framework/types";

import { describeError } from "../../../../../lib/describe-error";
import { ORDER_STATUS_MODULE } from "../../../../../modules/order-status";
import type OrderStatusModuleService from "../../../../../modules/order-status/service";
import { SHIPSTATION_LABEL_LOG_TAG } from "../../../../../modules/shipstation/lib";

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
) {
  const logger = req.scope.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const orderId = req.params.orderId ?? "";

  const service =
    req.scope.resolve<OrderStatusModuleService>(ORDER_STATUS_MODULE);

  const shipment = await service.activeShipment(orderId);

  if (!shipment?.label_file_id) {
    return res.status(404).json({
      error: "no_stored_label",
      reason: "no_stored_label",
      message: "There is no stored label for this order.",
    });
  }

  try {
    const fileService = req.scope.resolve<IFileModuleService>(Modules.FILE);
    const buffer = await fileService.getAsBuffer(shipment.label_file_id);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'inline; filename="label.pdf"');
    res.setHeader("Cache-Control", "private, no-store");

    return res.send(buffer);
  } catch (error) {
    const detail = describeError(error);
    logger.error(
      `${SHIPSTATION_LABEL_LOG_TAG} reason=label_read_failed order=${orderId} file=${shipment.label_file_id} error=${detail}`,
    );

    return res.status(502).json({
      error: "label_unavailable",
      reason: "label_unavailable",
      message: "We could not load the stored label for this order.",
    });
  }
}
