import { validateAndTransformBody } from "@medusajs/framework/http";
import type { MiddlewareRoute } from "@medusajs/framework/http";
import { taxQuoteRequestSchema } from "@craftynp/types";

const validatedBodySchema = taxQuoteRequestSchema as unknown as Parameters<
  typeof validateAndTransformBody
>[0];

export const taxQuoteMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/store/tax-quote",
    method: "POST",
    middlewares: [validateAndTransformBody(validatedBodySchema)],
  },
];
