import { Module } from "@medusajs/framework/utils";

import StripeTaxModuleService from "./service";

export const STRIPE_TAX_MODULE = "stripeTax";

export default Module(STRIPE_TAX_MODULE, {
  service: StripeTaxModuleService,
});
