import { ModuleProvider, Modules } from "@medusajs/framework/utils";

import GoogleWorkspaceAuthProviderService from "./service";

export default ModuleProvider(Modules.AUTH, {
  services: [GoogleWorkspaceAuthProviderService],
});
