import { validateAndTransformBody } from "@medusajs/framework/http";
import type { MiddlewareRoute } from "@medusajs/framework/http";
import {
  checkoutCompleteRequestSchema,
  checkoutPrepareRequestSchema,
} from "@craftynp/types";

const validatedPrepareBodySchema = checkoutPrepareRequestSchema as unknown as Parameters<
  typeof validateAndTransformBody
>[0];

const validatedCompleteBodySchema = checkoutCompleteRequestSchema as unknown as Parameters<
  typeof validateAndTransformBody
>[0];

export const checkoutMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/store/checkout/prepare-cart",
    method: "POST",
    middlewares: [validateAndTransformBody(validatedPrepareBodySchema)],
  },
  {
    matcher: "/store/checkout/complete",
    method: "POST",
    middlewares: [validateAndTransformBody(validatedCompleteBodySchema)],
  },
];
