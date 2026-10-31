import { model } from "@medusajs/framework/utils";

import ArtworkClaim from "./artwork-claim";

const ArtworkAsset = model
  .define("artwork_asset", {
    id: model.id().primaryKey(),
    upload_id: model.text().unique(),
    staging_key: model.text(),
    file_name: model.text(),
    mime_type: model.text(),
    size_bytes: model.number(),
    uploaded_at: model.dateTime(),
    purged_at: model.dateTime().nullable(),
    purge_reason: model.text().nullable(),
    width_px: model.number().nullable(),
    height_px: model.number().nullable(),
    inspected_at: model.dateTime().nullable(),
    inspected_etag: model.text().nullable(),
    claims: model.hasMany(() => ArtworkClaim, {
      mappedBy: "asset",
    }),
  })
  .indexes([{ on: ["staging_key"] }]);

export default ArtworkAsset;
