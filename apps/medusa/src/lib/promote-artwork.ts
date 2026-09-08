import type { Logger } from "@medusajs/framework/types";

import {
  ARTWORK_PROMOTE_FAILED_LOG_TAG,
  ARTWORK_PROMOTE_LOG_TAG,
} from "./artwork-retention";
import {
  artworkObjectKey,
  copyArtwork,
  deleteArtwork,
  headArtwork,
} from "./artwork-storage";
import { describeError } from "./describe-error";
import type ArtworkModuleService from "../modules/artwork/service";
import type { ArtworkAssetRow } from "../modules/artwork/service";

export function keyExtension(stagingKey: string): string {
  const dot = stagingKey.lastIndexOf(".");
  return dot === -1 ? "bin" : stagingKey.slice(dot + 1);
}

export type PromotionTarget = {
  asset: ArtworkAssetRow;
  orderId: string;
  lineItemId: string;
};

export async function promoteArtworkAsset(
  target: PromotionTarget,
  artwork: ArtworkModuleService,
  logger: Logger,
): Promise<boolean> {
  const { asset, orderId, lineItemId } = target;

  if (asset.promoted_at != null) return true;

  let destination: string;
  try {
    // Inside the try: artworkObjectKey throws on an unsafe id, and this
    // function is relied on never to throw — the subscriber's loop would
    // otherwise abandon every remaining line item on the order.
    destination = artworkObjectKey(
      orderId,
      lineItemId,
      asset.upload_id,
      keyExtension(asset.staging_key),
    );

    await headArtwork(asset.staging_key);
    await copyArtwork(asset.staging_key, destination);
    await artwork.markPromoted(asset.id, {
      orderId,
      lineItemId,
      storageKey: destination,
    });
  } catch (error) {
    logger.warn(
      `${ARTWORK_PROMOTE_FAILED_LOG_TAG} asset=${asset.id} order=${orderId} key=${asset.staging_key} error=${describeError(error)}`,
    );
    return false;
  }

  // The copy is committed. A failed cleanup is not a failed promotion — the
  // staging lifecycle rule reaps the leftover, and throwing here would send
  // the sweeper back round to re-copy an object that is already in place.
  try {
    await deleteArtwork(asset.staging_key);
  } catch (error) {
    logger.warn(
      `${ARTWORK_PROMOTE_LOG_TAG} asset=${asset.id} outcome=staging_not_removed error=${describeError(error)}`,
    );
  }

  logger.info(
    `${ARTWORK_PROMOTE_LOG_TAG} asset=${asset.id} order=${orderId} key=${destination}`,
  );

  return true;
}
