import { ModuleProvider, Modules } from "@medusajs/framework/utils";

import ShipStationFulfillmentProviderService from "./service";

export default ModuleProvider(Modules.FULFILLMENT, {
  services: [ShipStationFulfillmentProviderService],
});
