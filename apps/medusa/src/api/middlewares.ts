import { defineMiddlewares } from "@medusajs/framework/http";

import { siteContentMiddlewares } from "./admin/site-content/middlewares";

export default defineMiddlewares({
  routes: [...siteContentMiddlewares],
});
