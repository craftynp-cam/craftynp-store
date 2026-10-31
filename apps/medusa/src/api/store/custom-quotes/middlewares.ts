import { validateAndTransformBody } from "@medusajs/framework/http";
import type { MiddlewareRoute } from "@medusajs/framework/http";
import { customQuoteRequestSchema } from "@craftynp/types";

import { rateLimit, ruleFromEnv } from "../../../lib/rate-limit";

const validatedBodySchema = customQuoteRequestSchema as unknown as Parameters<
  typeof validateAndTransformBody
>[0];

export const customQuoteMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/store/custom-quotes",
    method: "POST",
    middlewares: [
      rateLimit(
        ruleFromEnv("custom-quotes", "RATE_LIMIT_CUSTOM_QUOTES_PER_MINUTE", 3),
      ),
      validateAndTransformBody(validatedBodySchema),
    ],
  },
];
