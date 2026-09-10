import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { Logger } from "@medusajs/framework/types";
import { MAX_ARTWORK_BYTES, artworkMimeTypeSchema } from "@craftynp/types";
import type { ArtworkInspectResponse } from "@craftynp/types";

import { ARTWORK_MODULE } from "../../../../../../modules/artwork";
import type ArtworkModuleService from "../../../../../../modules/artwork/service";
import {
  ARTWORK_HEADER_BYTES,
  inspectArtworkBytes,
} from "../../../../../../lib/artwork-inspection";
import {
  ArtworkStorageNotConfiguredError,
  readArtworkHead,
  readArtworkStorageOptions,
} from "../../../../../../lib/artwork-storage";
import { describeError } from "../../../../../../lib/describe-error";

export const ARTWORK_INSPECT_FAILED_LOG_TAG = "[artwork:inspect-failed]";

const REJECTION_MESSAGES = {
  mismatched_type:
    "That file is not the kind of file it claims to be. Export it again and re-upload.",
  unreadable:
    "We could not read that image. It may be damaged — export it again and re-upload.",
} as const;

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const artwork = req.scope.resolve<ArtworkModuleService>(ARTWORK_MODULE);
  const uploadId = req.params.uploadId ?? "";

  const asset = await artwork.findByUploadId(uploadId);

  // A promoted or purged upload has no staging object left to read, so it is
  // as absent as one that never existed.
  if (!asset || asset.promoted_at !== null || asset.purged_at !== null) {
    return res.status(404).json({
      error: "artwork_not_found",
      message: "That upload could not be found. Upload the file again.",
    });
  }

  const declaredMimeType = artworkMimeTypeSchema.safeParse(asset.mime_type);
  if (!declaredMimeType.success) {
    return res.status(422).json({
      error: "artwork_rejected",
      reason: "mismatched_type",
      message: REJECTION_MESSAGES.mismatched_type,
    });
  }

  let options;
  try {
    options = readArtworkStorageOptions();
  } catch (error) {
    if (error instanceof ArtworkStorageNotConfiguredError) {
      logger.error(`${ARTWORK_INSPECT_FAILED_LOG_TAG} ${error.message}`);
      return res.status(503).json({
        error: "artwork_storage_unavailable",
        reason: "not_configured",
        message: "Artwork uploads are unavailable. Please try again later.",
      });
    }
    throw error;
  }

  let inspection;
  try {
    const head = await readArtworkHead(
      asset.staging_key,
      ARTWORK_HEADER_BYTES,
      options,
    );

    inspection = inspectArtworkBytes(head, declaredMimeType.data);

    // A JPEG carrying a large colour profile or an embedded thumbnail can push
    // its start-of-frame marker past the head we read, and rejecting a good
    // file is the worst way for this gate to fail. A wrong signature at offset
    // zero is not worth re-reading for; a size we could not find might be.
    if (
      !inspection.ok &&
      inspection.reason === "unreadable" &&
      head.length < asset.size_bytes
    ) {
      const whole = await readArtworkHead(
        asset.staging_key,
        Math.min(asset.size_bytes, MAX_ARTWORK_BYTES),
        options,
      );
      inspection = inspectArtworkBytes(whole, declaredMimeType.data);
    }
  } catch (error) {
    const reason = describeError(error);
    logger.error(`${ARTWORK_INSPECT_FAILED_LOG_TAG} ${reason}`);
    return res.status(502).json({
      error: "artwork_storage_unavailable",
      reason,
      message: "Could not check that file. Please try again.",
    });
  }

  if (!inspection.ok) {
    return res.status(422).json({
      error: "artwork_rejected",
      reason: inspection.reason,
      message: REJECTION_MESSAGES[inspection.reason],
    });
  }

  // The measurement is written before it is answered, so the resolution the
  // shopper was gated on is the one the order can be checked against later.
  await artwork.recordDimensions(asset.id, {
    widthPx: inspection.widthPx,
    heightPx: inspection.heightPx,
  });

  const payload: ArtworkInspectResponse = {
    uploadId,
    kind: inspection.kind,
    widthPx: inspection.widthPx,
    heightPx: inspection.heightPx,
  };

  return res.status(200).json(payload);
}
