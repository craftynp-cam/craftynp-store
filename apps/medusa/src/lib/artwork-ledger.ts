import {
  isArtworkMimeType,
  isVectorArtwork,
  type ArtworkReference,
} from "@craftynp/types";

import type { ArtworkAssetRow } from "../modules/artwork/service";
import { checkoutWindowClosedBefore } from "./artwork-retention";

export type ArtworkLedgerRejection =
  "artwork_not_found" | "artwork_not_inspected";

export type ArtworkLedgerResult =
  | { ok: true; artwork: ArtworkReference }
  | { ok: false; reason: ArtworkLedgerRejection };

export function artworkFromLedger(
  reference: ArtworkReference,
  row: ArtworkAssetRow | undefined,
  now: Date,
): ArtworkLedgerResult {
  if (
    !row ||
    row.purged_at !== null ||
    row.order_id !== null ||
    row.promoted_at !== null ||
    row.uploaded_at.getTime() < checkoutWindowClosedBefore(now).getTime() ||
    !isArtworkMimeType(row.mime_type)
  ) {
    return { ok: false, reason: "artwork_not_found" };
  }

  const pixelsMissing =
    !isVectorArtwork(row.mime_type) &&
    (row.width_px === null || row.height_px === null);

  if (row.inspected_at === null || pixelsMissing) {
    return { ok: false, reason: "artwork_not_inspected" };
  }

  return {
    ok: true,
    artwork: {
      storageKey: reference.storageKey,
      fileName: row.file_name,
      mimeType: row.mime_type,
      sizeBytes: row.size_bytes,
      widthPx: row.width_px,
      heightPx: row.height_px,
    },
  };
}
