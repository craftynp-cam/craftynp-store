import { validateAndTransformBody } from "@medusajs/framework/http";
import type { MiddlewareRoute } from "@medusajs/framework/http";
import {
  orderStatusUpdateRequestSchema,
  recordShipmentRequestSchema,
  voidShipmentRequestSchema,
} from "@craftynp/types";

type ValidatedSchema = Parameters<typeof validateAndTransformBody>[0];

const statusUpdateSchema =
  orderStatusUpdateRequestSchema as unknown as ValidatedSchema;
const recordShipmentSchema =
  recordShipmentRequestSchema as unknown as ValidatedSchema;
const voidShipmentSchema =
  voidShipmentRequestSchema as unknown as ValidatedSchema;

export const orderStatusMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/admin/orders/:id/status",
    method: "POST",
    middlewares: [validateAndTransformBody(statusUpdateSchema)],
  },
  {
    matcher: "/admin/orders/:id/shipment",
    method: "POST",
    middlewares: [validateAndTransformBody(recordShipmentSchema)],
  },
  {
    matcher: "/admin/orders/:id/shipment/void",
    method: "POST",
    middlewares: [validateAndTransformBody(voidShipmentSchema)],
  },
];
