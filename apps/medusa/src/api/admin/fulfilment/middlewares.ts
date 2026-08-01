import { validateAndTransformBody } from "@medusajs/framework/http";
import type { MiddlewareRoute } from "@medusajs/framework/http";
import { printLabelsRequestSchema } from "@craftynp/types";

type ValidatedSchema = Parameters<typeof validateAndTransformBody>[0];

const printLabelsSchema =
  printLabelsRequestSchema as unknown as ValidatedSchema;

export const fulfilmentMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/admin/fulfilment/labels/print",
    method: "POST",
    middlewares: [validateAndTransformBody(printLabelsSchema)],
  },
];
