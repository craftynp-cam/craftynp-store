import { ModuleProvider, Modules } from "@medusajs/framework/utils";

import StripeTaxTaxProvider from "./tax-provider";

export default ModuleProvider(Modules.TAX, {
  services: [StripeTaxTaxProvider],
});
