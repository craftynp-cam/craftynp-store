import { validateAndTransformBody } from "@medusajs/framework/http";
import type { MiddlewareRoute } from "@medusajs/framework/http";
import { shippingRateRequestSchema } from "@craftynp/types";

import { rateLimit, ruleFromEnv } from "../../../lib/rate-limit";

const validatedBodySchema = shippingRateRequestSchema as unknown as Parameters<
  typeof validateAndTransformBody
>[0];

export const shippingRatesMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/store/shipping-rates",
    method: "POST",
    middlewares: [
      rateLimit(
        ruleFromEnv(
          "shipping-rates",
          "RATE_LIMIT_SHIPPING_RATES_PER_MINUTE",
          20,
        ),
      ),
      validateAndTransformBody(validatedBodySchema),
    ],
  },
];
