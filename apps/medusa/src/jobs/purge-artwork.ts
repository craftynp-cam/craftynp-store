import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { Logger, MedusaContainer } from "@medusajs/framework/types";

import { ARTWORK_MODULE } from "../modules/artwork";
import type ArtworkModuleService from "../modules/artwork/service";
import { ORDER_STATUS_MODULE } from "../modules/order-status";
import type OrderStatusModuleService from "../modules/order-status/service";
import {
  ARTWORK_PURGE_FAILED_LOG_TAG,
  ARTWORK_PURGE_LOG_TAG,
  readRetentionPolicy,
  selectPurgeCandidates,
} from "../lib/artwork-retention";
import { deleteArtwork } from "../lib/artwork-storage";
import { describeError } from "../lib/describe-error";

export type PurgeSummary = {
  scanned: number;
  due: number;
  purged: number;
  failed: number;
};

export async function purgeArtwork(
  container: MedusaContainer,
): Promise<PurgeSummary> {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const artwork = container.resolve<ArtworkModuleService>(ARTWORK_MODULE);
  const orderStatus =
    container.resolve<OrderStatusModuleService>(ORDER_STATUS_MODULE);

  const policy = readRetentionPolicy();
  const rows = await artwork.listPromotedUnpurged();

  // The cross-module join lives here, in the job: neither module reaches into
  // the other.
  const orderIds = [
    ...new Set(
      rows.map((row) => row.order_id).filter((id): id is string => !!id),
    ),
  ];
  const deliveredByOrder = await orderStatus.deliveredAtByOrder(orderIds);

  const deliveredByAsset = new Map<string, Date | null>(
    rows.map((row) => [
      row.id,
      row.order_id ? (deliveredByOrder.get(row.order_id) ?? null) : null,
    ]),
  );

  const due = selectPurgeCandidates(rows, deliveredByAsset, new Date(), policy);

  let purged = 0;
  let failed = 0;

  for (const { row, reason } of due) {
    try {
      // Only the artwork row and its object are ever touched. The order and
      // its line items are left exactly as they are.
      await deleteArtwork(row.storage_key as string);
      await artwork.markPurged(row.id, reason);
      purged += 1;
    } catch (error) {
      failed += 1;
      logger.warn(
        `${ARTWORK_PURGE_FAILED_LOG_TAG} asset=${row.id} key=${row.storage_key} error=${describeError(error)}`,
      );
    }
  }

  const summary: PurgeSummary = {
    scanned: rows.length,
    due: due.length,
    purged,
    failed,
  };
  const line = `${ARTWORK_PURGE_LOG_TAG} scanned=${summary.scanned} due=${summary.due} purged=${summary.purged} failed=${summary.failed} retention_days=${policy.retentionDays} fallback_days=${policy.fallbackDays}`;

  if (failed > 0) logger.warn(line);
  else logger.info(line);

  return summary;
}

export default async function purgeArtworkJob(container: MedusaContainer) {
  await purgeArtwork(container);
}

export const config = {
  name: "purge-artwork",
  schedule: "0 3 * * *",
};
