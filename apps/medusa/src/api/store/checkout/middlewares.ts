import { validateAndTransformBody } from "@medusajs/framework/http";
import type { MiddlewareRoute } from "@medusajs/framework/http";
import {
  checkoutCompleteRequestSchema,
  checkoutPrepareRequestSchema,
} from "@craftynp/types";

import { rateLimit, ruleFromEnv } from "../../../lib/rate-limit";

const validatedPrepareBodySchema =
  checkoutPrepareRequestSchema as unknown as Parameters<
    typeof validateAndTransformBody
  >[0];

const validatedCompleteBodySchema =
  checkoutCompleteRequestSchema as unknown as Parameters<
    typeof validateAndTransformBody
  >[0];

export const checkoutMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/store/checkout/prepare-cart",
    method: "POST",
    middlewares: [
      rateLimit(
        ruleFromEnv("prepare-cart", "RATE_LIMIT_PREPARE_CART_PER_MINUTE", 20),
      ),
      validateAndTransformBody(validatedPrepareBodySchema),
    ],
  },
  {
    matcher: "/store/checkout/complete",
    method: "POST",
    middlewares: [
      rateLimit(
        ruleFromEnv("complete", "RATE_LIMIT_CHECKOUT_COMPLETE_PER_MINUTE", 10),
      ),
      validateAndTransformBody(validatedCompleteBodySchema),
    ],
  },
];
