import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { Logger } from "@medusajs/framework/types";
import { artworkMimeTypeSchema } from "@craftynp/types";
import type { ArtworkInspectResponse } from "@craftynp/types";

import { ARTWORK_MODULE } from "../../../../../../modules/artwork";
import type ArtworkModuleService from "../../../../../../modules/artwork/service";
import {
  ARTWORK_FALLBACK_READ_BYTES,
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

const CHANGED_RESPONSE = {
  error: "artwork_changed",
  message: "That file changed after it was checked. Upload it again.",
} as const;

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const artwork = req.scope.resolve<ArtworkModuleService>(ARTWORK_MODULE);
  const uploadId = req.params.uploadId ?? "";

  const asset = await artwork.findByUploadId(uploadId);

  // A claimed upload already belongs to an order, whose line was checked
  // against what was measured here, and a purged one has no staging object
  // left to read. Either is as absent as one that never existed.
  if (!asset || asset.claimed || asset.purged_at !== null) {
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

  const storageUnavailable = (reason: string) => {
    logger.error(`${ARTWORK_INSPECT_FAILED_LOG_TAG} ${reason}`);
    return res.status(502).json({
      error: "artwork_storage_unavailable",
      reason,
      message: "Could not check that file. Please try again.",
    });
  };

  let inspection;
  let etag: string;
  try {
    const head = await readArtworkHead(
      asset.staging_key,
      ARTWORK_HEADER_BYTES,
      options,
    );

    if (head.etag === null) return storageUnavailable("no_etag");
    etag = head.etag;

    if (asset.inspected_etag !== null && asset.inspected_etag !== etag) {
      return res.status(409).json(CHANGED_RESPONSE);
    }

    inspection = inspectArtworkBytes(head.bytes, declaredMimeType.data);

    // A JPEG carrying a large colour profile or an embedded thumbnail can push
    // its start-of-frame marker past the head we read, and rejecting a good
    // file is the worst way for this gate to fail. A wrong signature at offset
    // zero is not worth re-reading for; a size we could not find might be.
    if (
      !inspection.ok &&
      inspection.reason === "unreadable" &&
      head.bytes.length < asset.size_bytes
    ) {
      const deeper = await readArtworkHead(
        asset.staging_key,
        Math.min(asset.size_bytes, ARTWORK_FALLBACK_READ_BYTES),
        options,
        { ifMatch: etag },
      );
      inspection = inspectArtworkBytes(deeper.bytes, declaredMimeType.data);
    }
  } catch (error) {
    return storageUnavailable(describeError(error));
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
  if (asset.inspected_etag === null) {
    const recorded = await artwork.recordInspection(asset.id, {
      widthPx: inspection.widthPx,
      heightPx: inspection.heightPx,
      inspectedAt: new Date(),
      etag,
    });

    if (!recorded) {
      const current = await artwork.findByUploadId(uploadId);
      if (current?.inspected_etag !== etag) {
        return res.status(409).json(CHANGED_RESPONSE);
      }
    }
  }

  const payload: ArtworkInspectResponse = {
    uploadId,
    kind: inspection.kind,
    widthPx: inspection.widthPx,
    heightPx: inspection.heightPx,
  };

  return res.status(200).json(payload);
}
