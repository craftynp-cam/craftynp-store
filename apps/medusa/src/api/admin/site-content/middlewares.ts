import { validateAndTransformBody } from "@medusajs/framework/http";
import type { MiddlewareRoute } from "@medusajs/framework/http";
import { siteContentUpdateSchema } from "@craftynp/types";

const validatedBodySchema = siteContentUpdateSchema as unknown as Parameters<
  typeof validateAndTransformBody
>[0];

export const siteContentMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/admin/site-content",
    method: "POST",
    middlewares: [validateAndTransformBody(validatedBodySchema)],
  },
];
