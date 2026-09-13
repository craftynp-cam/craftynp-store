import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { Logger } from "@medusajs/framework/types";

import { ARTWORK_MODULE } from "../modules/artwork";
import type ArtworkModuleService from "../modules/artwork/service";
import type { ArtworkClaimRow } from "../modules/artwork/service";
import {
  ARTWORK_PROMOTE_FAILED_LOG_TAG,
  ARTWORK_PROMOTE_SHARED_LOG_TAG,
} from "../lib/artwork-retention";
import { promoteArtworkClaim } from "../lib/promote-artwork";
import { describeError } from "../lib/describe-error";

type LineItem = {
  id: string;
  metadata?: Record<string, unknown> | null;
};

export function artworkKeyOnLineItem(item: LineItem): string | null {
  const customization = item.metadata?.customization;
  if (customization == null || typeof customization !== "object") return null;

  const artwork = (customization as Record<string, unknown>).artwork;
  if (artwork == null || typeof artwork !== "object") return null;

  const key = (artwork as Record<string, unknown>).storageKey;

  return typeof key === "string" && key !== "" ? key : null;
}

export default async function promoteArtworkHandler({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const artwork = container.resolve<ArtworkModuleService>(ARTWORK_MODULE);
  const orderId = event.data.id;

  // Nothing here may throw. It runs after payment, and a failure must never
  // roll back a paid order — the sweeper job retries whatever is left.
  try {
    const { data: orders } = await query.graph({
      entity: "order",
      fields: ["id", "items.id", "items.metadata"],
      filters: { id: orderId },
    });

    const items = (orders[0]?.items ?? []) as LineItem[];
    const claims: ArtworkClaimRow[] = [];

    // Every line is claimed before any is copied, so a failure part-way
    // through still leaves the sweeper a claim for each of them.
    for (const item of items) {
      const stagingKey = artworkKeyOnLineItem(item);
      if (!stagingKey) continue;

      // Its own try: one bad line item must not abandon the rest of the order.
      try {
        const asset = await artwork.findByStagingKey(stagingKey);
        if (!asset) {
          logger.warn(
            `${ARTWORK_PROMOTE_FAILED_LOG_TAG} order=${orderId} item=${item.id} key=${stagingKey} error=no_matching_upload`,
          );
          continue;
        }

        claims.push(
          await artwork.claimLine({
            assetId: asset.id,
            orderId,
            lineItemId: item.id,
          }),
        );
      } catch (error) {
        logger.warn(
          `${ARTWORK_PROMOTE_FAILED_LOG_TAG} order=${orderId} item=${item.id} error=${describeError(error)}`,
        );
      }
    }

    for (const assetId of new Set(claims.map((claim) => claim.asset_id))) {
      try {
        const otherOrders = new Set(
          (await artwork.listClaimsForAsset(assetId))
            .map((claim) => claim.order_id)
            .filter((id) => id !== orderId),
        );

        if (otherOrders.size > 0) {
          logger.warn(
            `${ARTWORK_PROMOTE_SHARED_LOG_TAG} asset=${assetId} order=${orderId} other_orders=${[...otherOrders].join(",")}`,
          );
        }
      } catch (error) {
        logger.warn(
          `${ARTWORK_PROMOTE_FAILED_LOG_TAG} order=${orderId} asset=${assetId} outcome=shared_not_checked error=${describeError(error)}`,
        );
      }
    }

    for (const claim of claims) {
      await promoteArtworkClaim(claim, artwork, logger);
    }
  } catch (error) {
    logger.warn(
      `${ARTWORK_PROMOTE_FAILED_LOG_TAG} order=${orderId} error=${describeError(error)}`,
    );
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
};
