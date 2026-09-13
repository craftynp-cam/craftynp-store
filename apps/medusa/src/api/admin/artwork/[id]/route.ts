import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { Logger } from "@medusajs/framework/types";
import type { ArtworkDownloadResponse } from "@craftynp/types";

import { ARTWORK_MODULE } from "../../../../modules/artwork";
import type ArtworkModuleService from "../../../../modules/artwork/service";
import {
  DEFAULT_SIGNED_URL_SECONDS,
  presignArtworkDownload,
} from "../../../../lib/artwork-storage";
import { describeError } from "../../../../lib/describe-error";

export const ARTWORK_DOWNLOAD_FAILED_LOG_TAG = "[artwork:download-failed]";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const artwork = req.scope.resolve<ArtworkModuleService>(ARTWORK_MODULE);
  const id = req.params.id as string;

  const asset = await artwork.findAsset(id);

  if (!asset || asset.purged_at != null || asset.storage_key == null) {
    return res.status(404).json({
      error: "artwork_unavailable",
      message: asset?.purged_at
        ? "This artwork has passed its retention window and was deleted."
        : "No stored artwork for that id.",
    });
  }

  try {
    // A signed URL rather than a proxied stream, unlike the label route: a
    // print-resolution file is far larger than a label PDF, and there is no
    // reason to move those bytes through Medusa.
    const url = await presignArtworkDownload({
      key: asset.storage_key,
      fileName: asset.file_name,
      expiresInSeconds: DEFAULT_SIGNED_URL_SECONDS,
    });

    const payload: ArtworkDownloadResponse = {
      url,
      expiresAt: new Date(
        Date.now() + DEFAULT_SIGNED_URL_SECONDS * 1000,
      ).toISOString(),
      fileName: asset.file_name,
    };

    res.setHeader("Cache-Control", "private, no-store");
    return res.status(200).json(payload);
  } catch (error) {
    const reason = describeError(error);
    logger.error(`${ARTWORK_DOWNLOAD_FAILED_LOG_TAG} ${id} ${reason}`);
    return res.status(502).json({
      error: "artwork_unavailable",
      reason,
      message: "Could not produce a download link for this artwork.",
    });
  }
}
