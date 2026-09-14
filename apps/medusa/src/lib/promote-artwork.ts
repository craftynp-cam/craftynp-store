import type { Logger } from "@medusajs/framework/types";

import {
  ARTWORK_CHANGED_AFTER_INSPECT_LOG_TAG,
  ARTWORK_PROMOTE_FAILED_LOG_TAG,
  ARTWORK_PROMOTE_LOG_TAG,
} from "./artwork-retention";
import {
  ArtworkChangedAfterInspectError,
  artworkObjectKey,
  copyArtwork,
  deleteArtwork,
  isMissingObject,
} from "./artwork-storage";
import { describeError } from "./describe-error";
import type ArtworkModuleService from "../modules/artwork/service";
import type { ArtworkClaimRow } from "../modules/artwork/service";

export function keyExtension(stagingKey: string): string {
  const dot = stagingKey.lastIndexOf(".");
  return dot === -1 ? "bin" : stagingKey.slice(dot + 1);
}

type ClaimState = Pick<
  ArtworkClaimRow,
  "id" | "storage_key" | "promoted_at" | "purged_at"
>;

export type PromotionSource =
  | { kind: "staging"; key: string }
  | { kind: "sibling"; key: string; claimId: string }
  | { kind: "missing" };

export type PromotionOutcome =
  "promoted" | "source_missing" | "changed_after_inspect" | "failed";

function isPending(
  claim: Pick<ClaimState, "promoted_at" | "purged_at">,
): boolean {
  return claim.promoted_at == null && claim.purged_at == null;
}

export function selectSiblingSource(
  claimId: string,
  claims: readonly ClaimState[],
): PromotionSource {
  for (const claim of claims) {
    if (claim.id === claimId) continue;
    if (claim.promoted_at == null || claim.purged_at != null) continue;
    if (claim.storage_key == null) continue;

    return { kind: "sibling", key: claim.storage_key, claimId: claim.id };
  }

  return { kind: "missing" };
}

export function stagingStillNeeded(
  claims: readonly Pick<ClaimState, "promoted_at" | "purged_at">[],
): boolean {
  return claims.some(isPending);
}

async function copyToClaim(
  claim: ArtworkClaimRow,
  destination: string,
  artwork: ArtworkModuleService,
  logger: Logger,
  context: string,
): Promise<PromotionSource> {
  const { asset } = claim;

  try {
    await copyArtwork(asset.staging_key, destination, undefined, {
      sourceEtag: asset.inspected_etag,
    });
    return { kind: "staging", key: asset.staging_key };
  } catch (error) {
    const changed = error instanceof ArtworkChangedAfterInspectError;
    if (!changed && !isMissingObject(error)) throw error;

    const source = selectSiblingSource(
      claim.id,
      await artwork.listClaimsForAsset(claim.asset_id),
    );
    if (source.kind !== "sibling") {
      if (changed) throw error;
      return source;
    }

    await copyArtwork(source.key, destination);

    if (changed) {
      logger.warn(
        `${ARTWORK_CHANGED_AFTER_INSPECT_LOG_TAG} ${context} resolution=sibling sibling=${source.claimId} key=${asset.staging_key} inspected_etag=${asset.inspected_etag}`,
      );
    }

    return source;
  }
}

async function retireChangedUpload(
  claim: ArtworkClaimRow,
  artwork: ArtworkModuleService,
  logger: Logger,
  context: string,
): Promise<void> {
  try {
    for (const sibling of await artwork.listClaimsForAsset(claim.asset_id)) {
      if (!isPending(sibling)) continue;
      await artwork.markClaimPurged(sibling.id, "changed_after_inspect");
    }
  } catch (error) {
    logger.warn(
      `${ARTWORK_PROMOTE_FAILED_LOG_TAG} ${context} outcome=changed_not_retired error=${describeError(error)}`,
    );
  }
}

export async function promoteArtworkClaim(
  claim: ArtworkClaimRow,
  artwork: ArtworkModuleService,
  logger: Logger,
): Promise<PromotionOutcome> {
  if (claim.promoted_at != null) return "promoted";

  const { asset } = claim;
  const context = `claim=${claim.id} asset=${claim.asset_id} order=${claim.order_id}`;

  let destination: string;
  let source: PromotionSource;
  try {
    // Inside the try: artworkObjectKey throws on an unsafe id, and this
    // function is relied on never to throw — the subscriber's loop would
    // otherwise abandon every remaining line item on the order.
    destination = artworkObjectKey(
      claim.order_id,
      claim.line_item_id,
      asset.upload_id,
      keyExtension(asset.staging_key),
    );

    source = await copyToClaim(claim, destination, artwork, logger, context);
    if (source.kind === "missing") {
      logger.warn(
        `${ARTWORK_PROMOTE_FAILED_LOG_TAG} ${context} key=${asset.staging_key} error=source_missing`,
      );
      return "source_missing";
    }

    await artwork.markClaimPromoted(claim.id, destination);
  } catch (error) {
    if (error instanceof ArtworkChangedAfterInspectError) {
      logger.warn(
        `${ARTWORK_CHANGED_AFTER_INSPECT_LOG_TAG} ${context} resolution=retired key=${asset.staging_key} inspected_etag=${asset.inspected_etag}`,
      );
      await retireChangedUpload(claim, artwork, logger, context);
      return "changed_after_inspect";
    }

    logger.warn(
      `${ARTWORK_PROMOTE_FAILED_LOG_TAG} ${context} key=${asset.staging_key} error=${describeError(error)}`,
    );
    return "failed";
  }

  // The copy is committed. A failed cleanup is not a failed promotion — the
  // staging lifecycle rule reaps the leftover, and throwing here would send
  // the sweeper back round to re-copy an object that is already in place.
  if (source.kind === "staging") {
    try {
      const claims = await artwork.listClaimsForAsset(claim.asset_id);
      if (!stagingStillNeeded(claims)) await deleteArtwork(asset.staging_key);
    } catch (error) {
      logger.warn(
        `${ARTWORK_PROMOTE_LOG_TAG} ${context} outcome=staging_not_removed error=${describeError(error)}`,
      );
    }
  }

  const binding =
    source.kind === "staging" && asset.inspected_etag == null
      ? " etag=unbound"
      : "";

  logger.info(
    `${ARTWORK_PROMOTE_LOG_TAG} ${context} source=${source.kind} key=${destination}${binding}`,
  );

  return "promoted";
}
