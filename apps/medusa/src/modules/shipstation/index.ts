import { Module } from "@medusajs/framework/utils";

import ShipStationModuleService from "./service";

export const SHIPSTATION_MODULE = "shipstation";

export default Module(SHIPSTATION_MODULE, {
  service: ShipStationModuleService,
});
