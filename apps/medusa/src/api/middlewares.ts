import { defineMiddlewares } from "@medusajs/framework/http";

import { adminSsoMiddlewares } from "./admin-sso/link/middlewares";
import { siteContentMiddlewares } from "./admin/site-content/middlewares";
import { shippingRatesMiddlewares } from "./store/shipping-rates/middlewares";

export default defineMiddlewares({
  routes: [
    ...siteContentMiddlewares,
    ...adminSsoMiddlewares,
    ...shippingRatesMiddlewares,
  ],
});
