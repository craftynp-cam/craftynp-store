import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import type { ArtworkOrderListResponse } from "@craftynp/types";

import { ARTWORK_MODULE } from "../../../modules/artwork";
import type ArtworkModuleService from "../../../modules/artwork/service";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const artwork = req.scope.resolve<ArtworkModuleService>(ARTWORK_MODULE);
  const orderId = req.query.order_id;

  if (typeof orderId !== "string" || orderId === "") {
    return res.status(400).json({
      error: "missing_order_id",
      message: "An order_id query parameter is required.",
    });
  }

  const assets = await artwork.listForOrder(orderId);

  const payload: ArtworkOrderListResponse = {
    artwork: assets.map((asset) => ({
      id: asset.id,
      fileName: asset.file_name,
      mimeType: asset.mime_type,
      sizeBytes: asset.size_bytes,
      lineItemId: asset.line_item_id,
      uploadedAt: asset.uploaded_at.toISOString(),
      promotedAt: asset.promoted_at?.toISOString() ?? null,
      purgedAt: asset.purged_at?.toISOString() ?? null,
    })),
  };

  return res.status(200).json(payload);
}
