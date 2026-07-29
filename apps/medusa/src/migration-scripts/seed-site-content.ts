import type { MedusaContainer } from "@medusajs/framework";

import { SITE_CONTENT_MODULE } from "../modules/site-content";
import type SiteContentModuleService from "../modules/site-content/service";

export default async function seed_site_content({
  container,
}: {
  container: MedusaContainer;
}) {
  const siteContentModuleService =
    container.resolve<SiteContentModuleService>(SITE_CONTENT_MODULE);

  const existing = await siteContentModuleService.listSiteContentEntries();
  const existingKeys = new Set(existing.map((entry) => entry.key));

  const seedEntries = [
    { key: "banner_enabled", value: "true" },
    { key: "banner_text", value: "Now Selling: GLITTER!" },
  ].filter((entry) => !existingKeys.has(entry.key));

  if (seedEntries.length > 0) {
    await siteContentModuleService.createSiteContentEntries(seedEntries);
  }
}
