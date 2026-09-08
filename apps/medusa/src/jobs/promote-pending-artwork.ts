import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { Logger, MedusaContainer } from "@medusajs/framework/types";

import { ARTWORK_MODULE } from "../modules/artwork";
import type ArtworkModuleService from "../modules/artwork/service";
import {
  ARTWORK_PROMOTE_ABANDONED_LOG_TAG,
  ARTWORK_PROMOTE_FAILED_LOG_TAG,
  STAGING_WINDOW_DAYS,
  stagingWindowClosedBefore,
} from "../lib/artwork-retention";
import { promoteArtworkAsset } from "../lib/promote-artwork";
import { describeError } from "../lib/describe-error";

// The subscriber swallows its failures so a paid order is never rolled back,
// which means the event bus never sees a failure to retry. This job is the
// only retry there is.
export async function promotePendingArtwork(container: MedusaContainer) {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const artwork = container.resolve<ArtworkModuleService>(ARTWORK_MODULE);

  const cutoff = stagingWindowClosedBefore(new Date());

  for (const asset of await artwork.listPendingPromotion()) {
    if (!asset.order_id || !asset.line_item_id) continue;

    // Past the staging window the source object is gone, so retrying can only
    // fail. Give up once, loudly, rather than emitting a warn every 15 minutes
    // forever on a tag that is an alerting target.
    if (asset.uploaded_at.getTime() < cutoff.getTime()) {
      logger.warn(
        `${ARTWORK_PROMOTE_ABANDONED_LOG_TAG} asset=${asset.id} order=${asset.order_id} key=${asset.staging_key} age_days=${STAGING_WINDOW_DAYS}+ reason=staging_expired`,
      );
      await artwork.markPurged(asset.id, "staging_expired");
      continue;
    }

    try {
      await promoteArtworkAsset(
        { asset, orderId: asset.order_id, lineItemId: asset.line_item_id },
        artwork,
        logger,
      );
    } catch (error) {
      logger.warn(
        `${ARTWORK_PROMOTE_FAILED_LOG_TAG} asset=${asset.id} error=${describeError(error)}`,
      );
    }
  }

  // An upload that never reached an order leaves a row behind. Its object is
  // already gone with the staging lifecycle rule; this is the row.
  for (const asset of await artwork.listAbandonedUploads(cutoff)) {
    try {
      await artwork.markPurged(asset.id, "never_ordered");
    } catch (error) {
      logger.warn(
        `${ARTWORK_PROMOTE_FAILED_LOG_TAG} asset=${asset.id} outcome=abandoned_not_marked error=${describeError(error)}`,
      );
    }
  }
}

export default async function promotePendingArtworkJob(
  container: MedusaContainer,
) {
  await promotePendingArtwork(container);
}

export const config = {
  name: "promote-pending-artwork",
  schedule: "*/15 * * * *",
};
