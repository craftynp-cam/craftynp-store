import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { resolveSiteContent } from "@craftynp/types";

import { SITE_CONTENT_MODULE } from "../../../modules/site-content";
import type SiteContentModuleService from "../../../modules/site-content/service";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const siteContentModuleService =
    req.scope.resolve<SiteContentModuleService>(SITE_CONTENT_MODULE);
  const entries = await siteContentModuleService.listSiteContentEntries();

  return res.json({ site_content: resolveSiteContent(entries) });
}
