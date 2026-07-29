import { MedusaService } from "@medusajs/framework/utils";

import SiteContentEntry from "./models/site-content-entry";

class SiteContentModuleService extends MedusaService({
  SiteContentEntry,
}) {}

export default SiteContentModuleService;
