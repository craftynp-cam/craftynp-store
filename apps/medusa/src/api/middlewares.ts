import { defineMiddlewares } from "@medusajs/framework/http";

import { adminSsoMiddlewares } from "./admin-sso/link/middlewares";
import { siteContentMiddlewares } from "./admin/site-content/middlewares";

export default defineMiddlewares({
  routes: [...siteContentMiddlewares, ...adminSsoMiddlewares],
});
