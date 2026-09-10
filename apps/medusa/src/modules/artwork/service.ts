import { MedusaService } from "@medusajs/framework/utils";

import ArtworkAsset from "./models/artwork-asset";

export type ArtworkAssetRow = {
  id: string;
  upload_id: string;
  staging_key: string;
  storage_key: string | null;
  order_id: string | null;
  line_item_id: string | null;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_at: Date;
  promoted_at: Date | null;
  purged_at: Date | null;
  purge_reason: string | null;
  width_px: number | null;
  height_px: number | null;
};

export type RecordUploadInput = {
  uploadId: string;
  stagingKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

export type PromoteInput = {
  orderId: string;
  lineItemId: string;
  storageKey: string;
};

function toDate(value: Date | string | null): Date | null {
  if (value == null) return null;
  return value instanceof Date ? value : new Date(value);
}

function toRow(raw: Record<string, unknown>): ArtworkAssetRow {
  return {
    ...(raw as unknown as ArtworkAssetRow),
    uploaded_at: toDate(raw.uploaded_at as Date | string) as Date,
    promoted_at: toDate(raw.promoted_at as Date | string | null),
    purged_at: toDate(raw.purged_at as Date | string | null),
  };
}

class ArtworkModuleService extends MedusaService({ ArtworkAsset }) {
  async recordUpload(input: RecordUploadInput): Promise<ArtworkAssetRow> {
    const created = await this.createArtworkAssets({
      upload_id: input.uploadId,
      staging_key: input.stagingKey,
      file_name: input.fileName,
      mime_type: input.mimeType,
      size_bytes: input.sizeBytes,
      uploaded_at: new Date(),
    });

    return toRow(created as unknown as Record<string, unknown>);
  }

  async findByUploadId(uploadId: string): Promise<ArtworkAssetRow | null> {
    const rows = (await this.listArtworkAssets({
      upload_id: uploadId,
    })) as unknown as Record<string, unknown>[];

    return rows[0] ? toRow(rows[0]) : null;
  }

  async findByStagingKey(stagingKey: string): Promise<ArtworkAssetRow | null> {
    const rows = (await this.listArtworkAssets({
      staging_key: stagingKey,
    })) as unknown as Record<string, unknown>[];

    return rows[0] ? toRow(rows[0]) : null;
  }

  async findAsset(id: string): Promise<ArtworkAssetRow | null> {
    const rows = (await this.listArtworkAssets({
      id,
    })) as unknown as Record<string, unknown>[];

    return rows[0] ? toRow(rows[0]) : null;
  }

  async listForOrder(orderId: string): Promise<ArtworkAssetRow[]> {
    const rows = (await this.listArtworkAssets({
      order_id: orderId,
    })) as unknown as Record<string, unknown>[];

    return rows.map(toRow);
  }

  async claimForOrder(
    id: string,
    orderId: string,
    lineItemId: string,
  ): Promise<void> {
    await this.updateArtworkAssets({
      id,
      order_id: orderId,
      line_item_id: lineItemId,
    });
  }

  async markPromoted(id: string, input: PromoteInput): Promise<void> {
    await this.updateArtworkAssets({
      id,
      order_id: input.orderId,
      line_item_id: input.lineItemId,
      storage_key: input.storageKey,
      promoted_at: new Date(),
    });
  }

  async recordDimensions(
    id: string,
    dimensions: { widthPx: number | null; heightPx: number | null },
  ): Promise<void> {
    await this.updateArtworkAssets({
      id,
      width_px: dimensions.widthPx,
      height_px: dimensions.heightPx,
    });
  }

  async markPurged(id: string, reason: string): Promise<void> {
    await this.updateArtworkAssets({
      id,
      purged_at: new Date(),
      purge_reason: reason,
    });
  }

  // Both discriminators stay in the query rather than in a .filter() after it.
  // An upload that never reaches an order leaves a row behind, and filtering
  // in JS would serialise every one of those out of Postgres on every run of
  // both scheduled jobs, forever.
  async listPromotedUnpurged(): Promise<ArtworkAssetRow[]> {
    const rows = (await this.listArtworkAssets({
      purged_at: null,
      promoted_at: { $ne: null },
    })) as unknown as Record<string, unknown>[];

    return rows.map(toRow);
  }

  async listPendingPromotion(): Promise<ArtworkAssetRow[]> {
    const rows = (await this.listArtworkAssets({
      promoted_at: null,
      purged_at: null,
      order_id: { $ne: null },
    })) as unknown as Record<string, unknown>[];

    return rows.map(toRow);
  }

  // Uploads that never made it onto an order. Their objects are already gone —
  // the staging lifecycle rule reaps those — so this is the row cleanup.
  async listAbandonedUploads(uploadedBefore: Date): Promise<ArtworkAssetRow[]> {
    const rows = (await this.listArtworkAssets({
      order_id: null,
      purged_at: null,
      uploaded_at: { $lt: uploadedBefore },
    })) as unknown as Record<string, unknown>[];

    return rows.map(toRow);
  }
}

export default ArtworkModuleService;
