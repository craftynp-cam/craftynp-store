import { ModuleProvider, Modules } from "@medusajs/framework/utils";

import Auth0AuthProviderService from "./service";

export default ModuleProvider(Modules.AUTH, {
  services: [Auth0AuthProviderService],
});
