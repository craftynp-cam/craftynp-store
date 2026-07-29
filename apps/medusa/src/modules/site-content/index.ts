import { Module } from "@medusajs/framework/utils";

import SiteContentModuleService from "./service";

export const SITE_CONTENT_MODULE = "siteContent";

export default Module(SITE_CONTENT_MODULE, {
  service: SiteContentModuleService,
});
