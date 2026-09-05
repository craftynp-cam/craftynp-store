import { Module } from "@medusajs/framework/utils";

import ArtworkModuleService from "./service";

export const ARTWORK_MODULE = "artwork";

export default Module(ARTWORK_MODULE, {
  service: ArtworkModuleService,
});
