import { model } from "@medusajs/framework/utils";

import ArtworkAsset from "./artwork-asset";

const ArtworkClaim = model
  .define("artwork_claim", {
    id: model.id().primaryKey(),
    order_id: model.text(),
    line_item_id: model.text().unique(),
    storage_key: model.text().nullable(),
    promoted_at: model.dateTime().nullable(),
    purged_at: model.dateTime().nullable(),
    purge_reason: model.text().nullable(),
    asset: model.belongsTo(() => ArtworkAsset, {
      mappedBy: "claims",
    }),
  })
  .indexes([{ on: ["order_id"] }]);

export default ArtworkClaim;
