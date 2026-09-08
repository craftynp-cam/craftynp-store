import { randomUUID } from "node:crypto";

import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { Logger } from "@medusajs/framework/types";
import { artworkExtension } from "@craftynp/types";
import type {
  ArtworkUploadRequest,
  ArtworkUploadResponse,
} from "@craftynp/types";

import { ARTWORK_MODULE } from "../../../../modules/artwork";
import type ArtworkModuleService from "../../../../modules/artwork/service";
import {
  ArtworkStorageNotConfiguredError,
  presignArtworkUpload,
  readArtworkStorageOptions,
  readUploadUrlTtlSeconds,
  stagingObjectKey,
} from "../../../../lib/artwork-storage";
import { describeError } from "../../../../lib/describe-error";

export const ARTWORK_UPLOAD_FAILED_LOG_TAG = "[artwork:upload-url-failed]";

export async function POST(
  req: MedusaRequest<ArtworkUploadRequest>,
  res: MedusaResponse,
) {
  const logger = req.scope.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const artwork = req.scope.resolve<ArtworkModuleService>(ARTWORK_MODULE);
  const body = req.validatedBody;

  let options;
  try {
    options = readArtworkStorageOptions();
  } catch (error) {
    if (error instanceof ArtworkStorageNotConfiguredError) {
      logger.error(`${ARTWORK_UPLOAD_FAILED_LOG_TAG} ${error.message}`);
      return res.status(503).json({
        error: "artwork_storage_unavailable",
        reason: "not_configured",
        message: "Artwork uploads are unavailable. Please try again later.",
      });
    }
    throw error;
  }

  const uploadId = randomUUID();
  const stagingKey = stagingObjectKey(
    uploadId,
    artworkExtension(body.mimeType),
  );
  const ttlSeconds = readUploadUrlTtlSeconds();

  try {
    const uploadUrl = await presignArtworkUpload(
      {
        key: stagingKey,
        contentType: body.mimeType,
        contentLength: body.sizeBytes,
        expiresInSeconds: ttlSeconds,
      },
      options,
    );

    await artwork.recordUpload({
      uploadId,
      stagingKey,
      fileName: body.fileName,
      mimeType: body.mimeType,
      sizeBytes: body.sizeBytes,
    });

    const payload: ArtworkUploadResponse = {
      uploadId,
      storageKey: stagingKey,
      uploadUrl,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
      // content-length is in the signature: a PUT of any other size is
      // refused, which is what bounds one presigned URL. content-type is not
      // signable on an S3 presigned PUT — it is sent so the object is stored
      // with the right type, not as a gate. See artwork-storage.ts.
      requiredHeaders: {
        "content-type": body.mimeType,
        "content-length": String(body.sizeBytes),
      },
    };

    return res.status(200).json(payload);
  } catch (error) {
    const reason = describeError(error);
    logger.error(`${ARTWORK_UPLOAD_FAILED_LOG_TAG} ${reason}`);
    return res.status(502).json({
      error: "artwork_storage_unavailable",
      reason,
      message: "Could not start the upload. Please try again.",
    });
  }
}
