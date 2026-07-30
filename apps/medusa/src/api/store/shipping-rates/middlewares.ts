import { validateAndTransformBody } from "@medusajs/framework/http";
import type { MiddlewareRoute } from "@medusajs/framework/http";
import { shippingRateRequestSchema } from "@craftynp/types";

const validatedBodySchema = shippingRateRequestSchema as unknown as Parameters<
  typeof validateAndTransformBody
>[0];

export const shippingRatesMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/store/shipping-rates",
    method: "POST",
    middlewares: [validateAndTransformBody(validatedBodySchema)],
  },
];
