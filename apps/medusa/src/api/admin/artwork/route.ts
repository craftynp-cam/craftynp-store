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

  const claims = await artwork.listClaimsForOrder(orderId);

  const payload: ArtworkOrderListResponse = {
    artwork: claims.map((claim) => ({
      id: claim.id,
      fileName: claim.asset.file_name,
      mimeType: claim.asset.mime_type,
      sizeBytes: claim.asset.size_bytes,
      lineItemId: claim.line_item_id,
      uploadedAt: claim.asset.uploaded_at.toISOString(),
      promotedAt: claim.promoted_at?.toISOString() ?? null,
      purgedAt: claim.purged_at?.toISOString() ?? null,
      purgeReason: claim.purge_reason,
    })),
  };

  return res.status(200).json(payload);
}
