import { model } from "@medusajs/framework/utils";

const ArtworkAsset = model
  .define("artwork_asset", {
    id: model.id().primaryKey(),
    upload_id: model.text().unique(),
    staging_key: model.text(),
    storage_key: model.text().nullable(),
    order_id: model.text().nullable(),
    line_item_id: model.text().nullable(),
    file_name: model.text(),
    mime_type: model.text(),
    size_bytes: model.number(),
    uploaded_at: model.dateTime(),
    promoted_at: model.dateTime().nullable(),
    purged_at: model.dateTime().nullable(),
    purge_reason: model.text().nullable(),
    width_px: model.number().nullable(),
    height_px: model.number().nullable(),
    dpi: model.number().nullable(),
  })
  .indexes([{ on: ["order_id"] }]);

export default ArtworkAsset;
