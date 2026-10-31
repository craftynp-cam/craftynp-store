import { MedusaError } from "@medusajs/framework/utils";

import ArtworkModuleService from "./service";

const CLAIM = {
  id: "claim_1",
  asset_id: "asset_1",
  order_id: "order_1",
  line_item_id: "li_1",
  storage_key: null,
  promoted_at: null,
  purged_at: null,
  purge_reason: null,
  asset: {
    id: "asset_1",
    upload_id: "up_1",
    staging_key: "staging/up_1.png",
    file_name: "logo.png",
    mime_type: "image/png",
    size_bytes: 1,
    uploaded_at: "2026-09-10T00:00:00.000Z",
    purged_at: null,
    purge_reason: null,
    width_px: 1,
    height_px: 1,
    inspected_at: null,
    inspected_etag: null,
  },
};

function service() {
  const createArtworkClaims = jest.fn();
  const listArtworkClaims = jest.fn();
  const artwork = Object.assign(
    Object.create(ArtworkModuleService.prototype) as ArtworkModuleService,
    { createArtworkClaims, listArtworkClaims },
  );

  return { artwork, createArtworkClaims, listArtworkClaims };
}

describe("ArtworkModuleService.claimLine", () => {
  it("returns the line's existing claim when its insert clashes with the unique line item, as a redelivered order.placed does", async () => {
    const { artwork, createArtworkClaims, listArtworkClaims } = service();
    createArtworkClaims.mockRejectedValue(
      new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Artwork claim with line_item_id: li_1, already exists.",
      ),
    );
    listArtworkClaims.mockResolvedValue([CLAIM]);

    await expect(
      artwork.claimLine({
        assetId: "asset_1",
        orderId: "order_2",
        lineItemId: "li_1",
      }),
    ).resolves.toMatchObject({ id: "claim_1", order_id: "order_1" });
    expect(listArtworkClaims).toHaveBeenCalledWith(
      { line_item_id: "li_1" },
      { relations: ["asset"] },
    );
  });

  it("rethrows an insert failure that left no claim behind", async () => {
    const { artwork, createArtworkClaims, listArtworkClaims } = service();
    createArtworkClaims.mockRejectedValue(new Error("connection reset"));
    listArtworkClaims.mockResolvedValue([]);

    await expect(
      artwork.claimLine({
        assetId: "asset_1",
        orderId: "order_2",
        lineItemId: "li_1",
      }),
    ).rejects.toThrow("connection reset");
  });
});
