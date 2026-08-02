import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { Logger } from "@medusajs/framework/types";
import { randomUUID } from "node:crypto";

import { deleteLabel, labelObjectKey, putLabel } from "../../lib/label-storage";

import { SHIPSTATION_MODULE } from "../../modules/shipstation";
import { SHIPSTATION_LABEL_LOG_TAG } from "../../modules/shipstation/lib";
import type ShipStationModuleService from "../../modules/shipstation/service";

export type StoreLabelPdfStepInput = {
  orderId: string;
  displayId: number;
  labelId: string;
  pdfUrl: string | null;
};

type StoreLabelPdfCompensation = { fileId: string };

export type StoreLabelPdfStepOutput = {
  labelUrl: string;
  labelFileId: string | null;
  stored: boolean;
};

export function labelDownloadPath(orderId: string): string {
  return `/admin/fulfilment/labels/${orderId}`;
}

export const storeLabelPdfStep = createStep(
  "store-label-pdf",
  async (input: StoreLabelPdfStepInput, { container }) => {
    const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);

    if (!input.pdfUrl) {
      logger.error(
        `${SHIPSTATION_LABEL_LOG_TAG} reason=label_storage_failed order=${input.orderId} label=${input.labelId} error=no_pdf_url`,
      );
      return new StepResponse<
        StoreLabelPdfStepOutput,
        StoreLabelPdfCompensation
      >({ labelUrl: "", labelFileId: null, stored: false });
    }

    try {
      const shipstation =
        container.resolve<ShipStationModuleService>(SHIPSTATION_MODULE);

      const bytes = await shipstation.downloadLabelPdf(input.pdfUrl);
      const key = labelObjectKey(input.orderId, randomUUID());

      await putLabel(key, bytes);

      return new StepResponse<
        StoreLabelPdfStepOutput,
        StoreLabelPdfCompensation
      >(
        {
          labelUrl: labelDownloadPath(input.orderId),
          labelFileId: key,
          stored: true,
        },
        { fileId: key },
      );
    } catch (error) {
      logger.error(
        `${SHIPSTATION_LABEL_LOG_TAG} reason=label_storage_failed order=${input.orderId} label=${input.labelId} error=${error instanceof Error ? error.message : String(error)}`,
      );

      return new StepResponse<
        StoreLabelPdfStepOutput,
        StoreLabelPdfCompensation
      >({ labelUrl: input.pdfUrl, labelFileId: null, stored: false });
    }
  },
  async (compensationInput: StoreLabelPdfCompensation | undefined) => {
    if (!compensationInput) return;

    await deleteLabel(compensationInput.fileId);
  },
);
