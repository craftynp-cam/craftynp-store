import { MedusaService } from "@medusajs/framework/utils";

import ArtworkAsset from "./models/artwork-asset";
import ArtworkClaim from "./models/artwork-claim";

export type ArtworkAssetRow = {
  id: string;
  upload_id: string;
  staging_key: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_at: Date;
  purged_at: Date | null;
  purge_reason: string | null;
  width_px: number | null;
  height_px: number | null;
  inspected_at: Date | null;
  claimed: boolean;
};

export type ArtworkClaimRow = {
  id: string;
  asset_id: string;
  order_id: string;
  line_item_id: string;
  storage_key: string | null;
  promoted_at: Date | null;
  purged_at: Date | null;
  purge_reason: string | null;
  asset: Omit<ArtworkAssetRow, "claimed">;
};

export type RecordUploadInput = {
  uploadId: string;
  stagingKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

export type ClaimLineInput = {
  assetId: string;
  orderId: string;
  lineItemId: string;
};

export type RecordInspectionInput = {
  widthPx: number | null;
  heightPx: number | null;
  inspectedAt: Date;
};

type Raw = Record<string, unknown>;

function toDate(value: Date | string | null): Date | null {
  if (value == null) return null;
  return value instanceof Date ? value : new Date(value);
}

function toUploadRow(raw: Raw): Omit<ArtworkAssetRow, "claimed"> {
  return {
    ...(raw as unknown as Omit<ArtworkAssetRow, "claimed">),
    uploaded_at: toDate(raw.uploaded_at as Date | string) as Date,
    purged_at: toDate(raw.purged_at as Date | string | null),
    inspected_at: toDate(raw.inspected_at as Date | string | null),
  };
}

function toAssetRow(raw: Raw): ArtworkAssetRow {
  return {
    ...toUploadRow(raw),
    claimed: Array.isArray(raw.claims) && raw.claims.length > 0,
  };
}

function toClaimRow(raw: Raw): ArtworkClaimRow {
  return {
    ...(raw as unknown as ArtworkClaimRow),
    promoted_at: toDate(raw.promoted_at as Date | string | null),
    purged_at: toDate(raw.purged_at as Date | string | null),
    asset: toUploadRow(raw.asset as Raw),
  };
}

class ArtworkModuleService extends MedusaService({
  ArtworkAsset,
  ArtworkClaim,
}) {
  async recordUpload(input: RecordUploadInput): Promise<ArtworkAssetRow> {
    const created = await this.createArtworkAssets({
      upload_id: input.uploadId,
      staging_key: input.stagingKey,
      file_name: input.fileName,
      mime_type: input.mimeType,
      size_bytes: input.sizeBytes,
      uploaded_at: new Date(),
    });

    return toAssetRow(created as unknown as Raw);
  }

  async findByUploadId(uploadId: string): Promise<ArtworkAssetRow | null> {
    const [row] = await this.listAssetsWithClaims({ upload_id: uploadId });
    return row ?? null;
  }

  async findByStagingKey(stagingKey: string): Promise<ArtworkAssetRow | null> {
    const [row] = await this.listAssetsWithClaims({ staging_key: stagingKey });
    return row ?? null;
  }

  async listByStagingKeys(
    stagingKeys: readonly string[],
  ): Promise<ArtworkAssetRow[]> {
    return this.listAssetsWithClaims({ staging_key: [...stagingKeys] });
  }

  async recordInspection(
    id: string,
    inspection: RecordInspectionInput,
  ): Promise<void> {
    await this.updateArtworkAssets({
      id,
      width_px: inspection.widthPx,
      height_px: inspection.heightPx,
      inspected_at: inspection.inspectedAt,
    });
  }

  async markPurged(id: string, reason: string): Promise<void> {
    await this.updateArtworkAssets({
      id,
      purged_at: new Date(),
      purge_reason: reason,
    });
  }

  async claimLine(input: ClaimLineInput): Promise<ArtworkClaimRow> {
    try {
      await this.createArtworkClaims({
        asset_id: input.assetId,
        order_id: input.orderId,
        line_item_id: input.lineItemId,
      });
    } catch (error) {
      const [existing] = await this.listClaims({
        line_item_id: input.lineItemId,
      });
      if (existing) return existing;
      throw error;
    }

    const [claim] = await this.listClaims({ line_item_id: input.lineItemId });
    if (!claim) {
      throw new Error(`No artwork claim was recorded for ${input.lineItemId}`);
    }

    return claim;
  }

  async findClaim(id: string): Promise<ArtworkClaimRow | null> {
    const [row] = await this.listClaims({ id });
    return row ?? null;
  }

  async listClaimsForOrder(orderId: string): Promise<ArtworkClaimRow[]> {
    return this.listClaims({ order_id: orderId });
  }

  async listClaimsForAsset(assetId: string): Promise<ArtworkClaimRow[]> {
    return this.listClaims({ asset_id: assetId });
  }

  async markClaimPromoted(id: string, storageKey: string): Promise<void> {
    await this.updateArtworkClaims({
      id,
      storage_key: storageKey,
      promoted_at: new Date(),
    });
  }

  async markClaimPurged(id: string, reason: string): Promise<void> {
    await this.updateArtworkClaims({
      id,
      purged_at: new Date(),
      purge_reason: reason,
    });
  }

  // Both discriminators stay in the query rather than in a .filter() after it.
  // Purged claims and uploads that never reach an order leave rows behind, and
  // filtering in JS would serialise every one of those out of Postgres on
  // every run of both scheduled jobs, forever.
  async listPromotedUnpurgedClaims(): Promise<ArtworkClaimRow[]> {
    return this.listClaims({ purged_at: null, promoted_at: { $ne: null } });
  }

  async listPendingClaims(): Promise<ArtworkClaimRow[]> {
    return this.listClaims({ promoted_at: null, purged_at: null });
  }

  // Uploads that never made it onto an order. Their objects are already gone —
  // the staging lifecycle rule reaps those — so this is the row cleanup.
  async listAbandonedUploads(uploadedBefore: Date): Promise<ArtworkAssetRow[]> {
    const rows = (await this.listArtworkAssets({
      purged_at: null,
      uploaded_at: { $lt: uploadedBefore },
      claims: { $none: {} },
    } as Parameters<typeof this.listArtworkAssets>[0])) as unknown as Raw[];

    return rows.map(toAssetRow);
  }

  private async listAssetsWithClaims(
    filters: Parameters<typeof this.listArtworkAssets>[0],
  ): Promise<ArtworkAssetRow[]> {
    const rows = (await this.listArtworkAssets(filters, {
      relations: ["claims"],
    })) as unknown as Raw[];

    return rows.map(toAssetRow);
  }

  private async listClaims(
    filters: Parameters<typeof this.listArtworkClaims>[0],
  ): Promise<ArtworkClaimRow[]> {
    const rows = (await this.listArtworkClaims(filters, {
      relations: ["asset"],
    })) as unknown as Raw[];

    return rows.map(toClaimRow);
  }
}

export default ArtworkModuleService;
