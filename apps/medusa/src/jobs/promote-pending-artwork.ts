import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { Logger, MedusaContainer } from "@medusajs/framework/types";

import { ARTWORK_MODULE } from "../modules/artwork";
import type ArtworkModuleService from "../modules/artwork/service";
import { ARTWORK_PROMOTE_FAILED_LOG_TAG } from "../lib/artwork-retention";
import { promoteArtworkAsset } from "../lib/promote-artwork";
import { describeError } from "../lib/describe-error";

// The subscriber swallows its failures so a paid order is never rolled back,
// which means the event bus never sees a failure to retry. This job is the
// only retry there is.
export default async function promotePendingArtwork(
  container: MedusaContainer,
) {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const artwork = container.resolve<ArtworkModuleService>(ARTWORK_MODULE);

  const pending = await artwork.listPendingPromotion();
  if (pending.length === 0) return;

  for (const asset of pending) {
    if (!asset.order_id || !asset.line_item_id) continue;

    try {
      await promoteArtworkAsset(
        {
          asset,
          orderId: asset.order_id,
          lineItemId: asset.line_item_id,
        },
        artwork,
        logger,
      );
    } catch (error) {
      logger.warn(
        `${ARTWORK_PROMOTE_FAILED_LOG_TAG} asset=${asset.id} error=${describeError(error)}`,
      );
    }
  }
}

export const config = {
  name: "promote-pending-artwork",
  schedule: "*/15 * * * *",
};
