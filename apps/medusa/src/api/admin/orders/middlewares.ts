import { validateAndTransformBody } from "@medusajs/framework/http";
import type { MiddlewareRoute } from "@medusajs/framework/http";
import {
  buyLabelRequestSchema,
  orderStatusUpdateRequestSchema,
  rateShipmentRequestSchema,
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
const rateShipmentSchema =
  rateShipmentRequestSchema as unknown as ValidatedSchema;
const buyLabelSchema = buyLabelRequestSchema as unknown as ValidatedSchema;

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
    matcher: "/admin/orders/:id/shipment/rates",
    method: "POST",
    middlewares: [validateAndTransformBody(rateShipmentSchema)],
  },
  {
    matcher: "/admin/orders/:id/shipment/buy",
    method: "POST",
    middlewares: [validateAndTransformBody(buyLabelSchema)],
  },
  {
    matcher: "/admin/orders/:id/shipment/void",
    method: "POST",
    middlewares: [validateAndTransformBody(voidShipmentSchema)],
  },
];
