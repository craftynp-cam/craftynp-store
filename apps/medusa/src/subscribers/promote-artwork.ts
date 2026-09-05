import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { Logger } from "@medusajs/framework/types";

import { ARTWORK_MODULE } from "../modules/artwork";
import type ArtworkModuleService from "../modules/artwork/service";
import { ARTWORK_PROMOTE_FAILED_LOG_TAG } from "../lib/artwork-retention";
import { promoteArtworkAsset } from "../lib/promote-artwork";
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

    for (const item of items) {
      const stagingKey = artworkKeyOnLineItem(item);
      if (!stagingKey) continue;

      const asset = await artwork.findByStagingKey(stagingKey);
      if (!asset) {
        logger.warn(
          `${ARTWORK_PROMOTE_FAILED_LOG_TAG} order=${orderId} item=${item.id} key=${stagingKey} error=no_matching_upload`,
        );
        continue;
      }

      // Claimed before the copy, so a failed promotion still leaves the
      // sweeper a row it can find.
      await artwork.claimForOrder(asset.id, orderId, item.id);
      await promoteArtworkAsset(
        { asset, orderId, lineItemId: item.id },
        artwork,
        logger,
      );
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
