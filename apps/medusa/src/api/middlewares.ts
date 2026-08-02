import { defineMiddlewares } from "@medusajs/framework/http";

import { originGuard } from "../lib/origin-guard";
import { adminSsoMiddlewares } from "./admin-sso/link/middlewares";
import { fulfilmentMiddlewares } from "./admin/fulfilment/middlewares";
import { orderStatusMiddlewares } from "./admin/orders/middlewares";
import { siteContentMiddlewares } from "./admin/site-content/middlewares";
import { shipstationTrackMiddlewares } from "./hooks/shipstation/track/middlewares";
import { checkoutMiddlewares } from "./store/checkout/middlewares";
import { orderConfirmationMiddlewares } from "./store/order-confirmation/middlewares";
import { shippingRatesMiddlewares } from "./store/shipping-rates/middlewares";
import { taxQuoteMiddlewares } from "./store/tax-quote/middlewares";

export default defineMiddlewares({
  routes: [
    // First, and on everything. The webhooks are deliberately not exempt: they
    // arrive through Cloudflare like everything else, so they carry the header,
    // and exempting them would leave the two most sensitive routes open on the
    // platform's own hostname. GET /health needs no exemption either — it is
    // registered by `medusa start` on the Express app, so it never reaches
    // defineMiddlewares at all.
    { matcher: "/*", middlewares: [originGuard()] },
    ...siteContentMiddlewares,
    ...orderStatusMiddlewares,
    ...fulfilmentMiddlewares,
    ...adminSsoMiddlewares,
    ...shipstationTrackMiddlewares,
    ...shippingRatesMiddlewares,
    ...taxQuoteMiddlewares,
    ...checkoutMiddlewares,
    ...orderConfirmationMiddlewares,
  ],
});
