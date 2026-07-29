import { model } from "@medusajs/framework/utils";

const SiteContentEntry = model.define("site_content_entry", {
  id: model.id().primaryKey(),
  key: model.text().unique(),
  value: model.text(),
});

export default SiteContentEntry;
