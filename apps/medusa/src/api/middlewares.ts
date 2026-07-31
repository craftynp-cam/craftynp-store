import { defineMiddlewares } from "@medusajs/framework/http";

import { adminSsoMiddlewares } from "./admin-sso/link/middlewares";
import { siteContentMiddlewares } from "./admin/site-content/middlewares";
import { checkoutMiddlewares } from "./store/checkout/middlewares";
import { shippingRatesMiddlewares } from "./store/shipping-rates/middlewares";
import { taxQuoteMiddlewares } from "./store/tax-quote/middlewares";

export default defineMiddlewares({
  routes: [
    ...siteContentMiddlewares,
    ...adminSsoMiddlewares,
    ...shippingRatesMiddlewares,
    ...taxQuoteMiddlewares,
    ...checkoutMiddlewares,
  ],
});
