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

export type PromotionOutcome = "promoted" | "source_missing" | "failed";

export function selectPromotionSource(
  target: { claimId: string; stagingKey: string; stagingExists: boolean },
  claims: readonly ClaimState[],
): PromotionSource {
  if (target.stagingExists) return { kind: "staging", key: target.stagingKey };

  for (const claim of claims) {
    if (claim.id === target.claimId) continue;
    if (claim.promoted_at == null || claim.purged_at != null) continue;
    if (claim.storage_key == null) continue;

    return { kind: "sibling", key: claim.storage_key, claimId: claim.id };
  }

  return { kind: "missing" };
}

export function stagingStillNeeded(
  claims: readonly Pick<ClaimState, "promoted_at" | "purged_at">[],
): boolean {
  return claims.some(
    (claim) => claim.promoted_at == null && claim.purged_at == null,
  );
}

async function stagingExists(key: string): Promise<boolean> {
  try {
    await headArtwork(key);
    return true;
  } catch (error) {
    if (isMissingObject(error)) return false;
    throw error;
  }
}

async function copyToClaim(
  claim: ArtworkClaimRow,
  destination: string,
  artwork: ArtworkModuleService,
): Promise<PromotionSource> {
  const target = { claimId: claim.id, stagingKey: claim.asset.staging_key };
  const exists = await stagingExists(target.stagingKey);

  let source = selectPromotionSource(
    { ...target, stagingExists: exists },
    exists ? [] : await artwork.listClaimsForAsset(claim.asset_id),
  );
  if (source.kind === "missing") return source;

  try {
    await copyArtwork(source.key, destination);
    return source;
  } catch (error) {
    if (source.kind !== "staging" || !isMissingObject(error)) throw error;
  }

  source = selectPromotionSource(
    { ...target, stagingExists: false },
    await artwork.listClaimsForAsset(claim.asset_id),
  );
  if (source.kind !== "missing") await copyArtwork(source.key, destination);

  return source;
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

    source = await copyToClaim(claim, destination, artwork);
    if (source.kind === "missing") {
      logger.warn(
        `${ARTWORK_PROMOTE_FAILED_LOG_TAG} ${context} key=${asset.staging_key} error=source_missing`,
      );
      return "source_missing";
    }

    await artwork.markClaimPromoted(claim.id, destination);
  } catch (error) {
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

  logger.info(
    `${ARTWORK_PROMOTE_LOG_TAG} ${context} source=${source.kind} key=${destination}`,
  );

  return "promoted";
}
