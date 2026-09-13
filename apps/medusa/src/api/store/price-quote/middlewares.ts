import { validateAndTransformBody } from "@medusajs/framework/http";
import type { MiddlewareRoute } from "@medusajs/framework/http";
import { priceQuoteRequestSchema } from "@craftynp/types";

import { rateLimit, ruleFromEnv } from "../../../lib/rate-limit";

const validatedBodySchema = priceQuoteRequestSchema as unknown as Parameters<
  typeof validateAndTransformBody
>[0];

export const priceQuoteMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/store/price-quote",
    method: "POST",
    middlewares: [
      // Higher than the tax and shipping limits: this fires on every
      // configurator change and costs only a database read, where those spend
      // money with a third party on every call.
      rateLimit(
        ruleFromEnv("price-quote", "RATE_LIMIT_PRICE_QUOTE_PER_MINUTE", 60),
      ),
      validateAndTransformBody(validatedBodySchema),
    ],
  },
];
