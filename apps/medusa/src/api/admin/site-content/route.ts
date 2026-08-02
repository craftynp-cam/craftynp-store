import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { resolveSiteContent } from "@craftynp/types";
import type { SiteContentUpdate } from "@craftynp/types";

import { SITE_CONTENT_MODULE } from "../../../modules/site-content";
import type SiteContentModuleService from "../../../modules/site-content/service";
import upsertSiteContentWorkflow from "../../../workflows/upsert-site-content";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const siteContentModuleService =
    req.scope.resolve<SiteContentModuleService>(SITE_CONTENT_MODULE);
  const entries = await siteContentModuleService.listSiteContentEntries();

  return res.json({ site_content: resolveSiteContent(entries) });
}

export async function POST(
  req: MedusaRequest<SiteContentUpdate>,
  res: MedusaResponse,
) {
  await upsertSiteContentWorkflow(req.scope).run({
    input: { entries: req.validatedBody.entries },
  });

  const siteContentModuleService =
    req.scope.resolve<SiteContentModuleService>(SITE_CONTENT_MODULE);
  const entries = await siteContentModuleService.listSiteContentEntries();

  return res.json({ site_content: resolveSiteContent(entries) });
}
