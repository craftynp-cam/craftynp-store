import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

import type { ArtworkClaimRow } from "../../../modules/artwork/service";
import { GET } from "./route";

const FILED = new Date(Date.UTC(2026, 8, 11, 12));
const EXPIRED = new Date(Date.UTC(2026, 8, 17, 12));

const ASSET: ArtworkClaimRow["asset"] = {
  id: "asset_1",
  upload_id: "up_1",
  staging_key: "staging/up_1.png",
  file_name: "logo.png",
  mime_type: "image/png",
  size_bytes: 51_200,
  uploaded_at: new Date(Date.UTC(2026, 8, 10, 12)),
  purged_at: null,
  purge_reason: null,
  width_px: 3000,
  height_px: 3000,
  inspected_at: new Date(Date.UTC(2026, 8, 10, 12)),
  inspected_etag: '"etag-1"',
};

describe("GET /admin/artwork", () => {
  it("lists one entry per line, so two lines sharing an upload each carry their own state", async () => {
    const claims: ArtworkClaimRow[] = [
      {
        id: "claim_1",
        asset_id: "asset_1",
        order_id: "order_1",
        line_item_id: "li_1",
        storage_key: "artwork/order_1/li_1/up_1.png",
        promoted_at: FILED,
        purged_at: null,
        purge_reason: null,
        asset: ASSET,
      },
      {
        id: "claim_2",
        asset_id: "asset_1",
        order_id: "order_1",
        line_item_id: "li_2",
        storage_key: null,
        promoted_at: null,
        purged_at: EXPIRED,
        purge_reason: "staging_expired",
        asset: ASSET,
      },
    ];
    const listClaimsForOrder = jest.fn(async () => claims);
    const json = jest.fn();
    const req = {
      query: { order_id: "order_1" },
      scope: { resolve: () => ({ listClaimsForOrder }) },
    } as unknown as MedusaRequest;
    const res = {
      status: jest.fn().mockReturnValue({ json }),
    } as unknown as MedusaResponse;

    await GET(req, res);

    expect(listClaimsForOrder).toHaveBeenCalledWith("order_1");
    expect(json).toHaveBeenCalledWith({
      artwork: [
        {
          id: "claim_1",
          fileName: "logo.png",
          mimeType: "image/png",
          sizeBytes: 51_200,
          lineItemId: "li_1",
          uploadedAt: "2026-09-10T12:00:00.000Z",
          promotedAt: "2026-09-11T12:00:00.000Z",
          purgedAt: null,
          purgeReason: null,
        },
        {
          id: "claim_2",
          fileName: "logo.png",
          mimeType: "image/png",
          sizeBytes: 51_200,
          lineItemId: "li_2",
          uploadedAt: "2026-09-10T12:00:00.000Z",
          promotedAt: null,
          purgedAt: "2026-09-17T12:00:00.000Z",
          purgeReason: "staging_expired",
        },
      ],
    });
  });
});
