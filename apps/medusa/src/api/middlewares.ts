import { defineMiddlewares } from "@medusajs/framework/http";

import { adminSsoMiddlewares } from "./admin-sso/link/middlewares";
import { orderStatusMiddlewares } from "./admin/orders/middlewares";
import { siteContentMiddlewares } from "./admin/site-content/middlewares";
import { shipstationTrackMiddlewares } from "./hooks/shipstation/track/middlewares";
import { checkoutMiddlewares } from "./store/checkout/middlewares";
import { orderConfirmationMiddlewares } from "./store/order-confirmation/middlewares";
import { shippingRatesMiddlewares } from "./store/shipping-rates/middlewares";
import { taxQuoteMiddlewares } from "./store/tax-quote/middlewares";

export default defineMiddlewares({
  routes: [
    ...siteContentMiddlewares,
    ...orderStatusMiddlewares,
    ...adminSsoMiddlewares,
    ...shipstationTrackMiddlewares,
    ...shippingRatesMiddlewares,
    ...taxQuoteMiddlewares,
    ...checkoutMiddlewares,
    ...orderConfirmationMiddlewares,
  ],
});
