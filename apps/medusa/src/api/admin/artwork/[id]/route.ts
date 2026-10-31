import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { Logger } from "@medusajs/framework/types";
import { artworkLineState } from "@craftynp/types";
import type {
  ArtworkDownloadResponse,
  ArtworkLineState,
} from "@craftynp/types";

import { ARTWORK_MODULE } from "../../../../modules/artwork";
import type ArtworkModuleService from "../../../../modules/artwork/service";
import {
  DEFAULT_SIGNED_URL_SECONDS,
  presignArtworkDownload,
} from "../../../../lib/artwork-storage";
import { describeError } from "../../../../lib/describe-error";

export const ARTWORK_DOWNLOAD_FAILED_LOG_TAG = "[artwork:download-failed]";

const UNAVAILABLE_MESSAGES = {
  missing: "No stored artwork for that id.",
  unclaimed: "No stored artwork for that id.",
  filing: "This artwork is still being filed. Try again shortly.",
  never_filed:
    "This artwork was never filed: its upload expired before it could be copied onto the order.",
  replaced:
    "This artwork was changed after it was checked, so it was not filed.",
  deleted: "This artwork has passed its retention window and was deleted.",
} as const satisfies Record<
  Exclude<ArtworkLineState["kind"], "download"> | "missing",
  string
>;

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const artwork = req.scope.resolve<ArtworkModuleService>(ARTWORK_MODULE);
  const id = req.params.id as string;

  const claim = await artwork.findClaim(id);
  const state = claim
    ? artworkLineState({
        id: claim.id,
        promotedAt: claim.promoted_at?.toISOString() ?? null,
        purgedAt: claim.purged_at?.toISOString() ?? null,
        purgeReason: claim.purge_reason,
      })
    : null;

  if (!claim || state?.kind !== "download" || claim.storage_key == null) {
    return res.status(404).json({
      error: "artwork_unavailable",
      message:
        UNAVAILABLE_MESSAGES[
          state && state.kind !== "download" ? state.kind : "missing"
        ],
    });
  }

  try {
    // A signed URL rather than a proxied stream, unlike the label route: a
    // print-resolution file is far larger than a label PDF, and there is no
    // reason to move those bytes through Medusa.
    const url = await presignArtworkDownload({
      key: claim.storage_key,
      fileName: claim.asset.file_name,
      expiresInSeconds: DEFAULT_SIGNED_URL_SECONDS,
    });

    const payload: ArtworkDownloadResponse = {
      url,
      expiresAt: new Date(
        Date.now() + DEFAULT_SIGNED_URL_SECONDS * 1000,
      ).toISOString(),
      fileName: claim.asset.file_name,
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
