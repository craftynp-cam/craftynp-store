import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { Logger } from "@medusajs/framework/types";
import type { PrintLabelsRequest } from "@craftynp/types";

import { describeError } from "../../../../../lib/describe-error";
import { loadLabelBytes } from "../../../../../lib/load-label-bytes";
import { mergeLabelPdfs } from "../../../../../lib/merge-label-pdfs";
import { SHIPSTATION_LABEL_LOG_TAG } from "../../../../../modules/shipstation/lib";

export const LABELS_UNAVAILABLE_HEADER = "x-labels-unavailable";

export async function POST(
  req: AuthenticatedMedusaRequest<PrintLabelsRequest>,
  res: MedusaResponse,
) {
  const logger = req.scope.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const orderIds = req.validatedBody.orderIds;

  try {
    const { buffers, unavailable } = await loadLabelBytes(req.scope, orderIds);

    if (buffers.length === 0) {
      return res.status(409).json({
        error: "no_labels",
        reason: "no_labels",
        message:
          "None of the selected orders have a label to print yet. Buy a label first.",
      });
    }

    if (unavailable.length > 0) {
      logger.warn(
        `${SHIPSTATION_LABEL_LOG_TAG} reason=batch_print_partial requested=${orderIds.length} printed=${buffers.length} missing=${unavailable.join(",")}`,
      );
    }

    const merged = await mergeLabelPdfs(buffers);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'inline; filename="labels.pdf"');
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader(LABELS_UNAVAILABLE_HEADER, unavailable.join(","));

    return res.send(merged);
  } catch (error) {
    const detail = describeError(error);
    logger.error(
      `${SHIPSTATION_LABEL_LOG_TAG} reason=batch_print_failed count=${orderIds.length} error=${detail}`,
    );

    return res.status(502).json({
      error: "batch_print_failed",
      reason: "batch_print_failed",
      message: "We could not build the print file. Try printing fewer orders.",
    });
  }
}
