import { validateAndTransformBody } from "@medusajs/framework/http";
import type { MiddlewareRoute } from "@medusajs/framework/http";
import { taxQuoteRequestSchema } from "@craftynp/types";

import { rateLimit, ruleFromEnv } from "../../../lib/rate-limit";

const validatedBodySchema = taxQuoteRequestSchema as unknown as Parameters<
  typeof validateAndTransformBody
>[0];

export const taxQuoteMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/store/tax-quote",
    method: "POST",
    middlewares: [
      rateLimit(
        ruleFromEnv("tax-quote", "RATE_LIMIT_TAX_QUOTE_PER_MINUTE", 20),
      ),
      validateAndTransformBody(validatedBodySchema),
    ],
  },
];
