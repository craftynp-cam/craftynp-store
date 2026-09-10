import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
  MiddlewareRoute,
} from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

import {
  assertDeclaredCustomization,
  type ProductCustomizationInput,
} from "../../../lib/product-customization";
import {
  assertPublishableProducts,
  type ProductShippingDimensionsInput,
} from "../../../lib/product-shipping-dimensions";

type ValidatedProduct = ProductCustomizationInput &
  ProductShippingDimensionsInput;

const GUARDED_KEYS = [
  "metadata",
  "status",
  "title",
  "weight",
  "length",
  "width",
  "height",
] as const;

export const PRODUCT_VALIDATION_FIELDS = ["id", ...GUARDED_KEYS];

export function touchesGuardedFields(body: Record<string, unknown>): boolean {
  return GUARDED_KEYS.some((key) => key in body);
}

function pickNumber(
  body: Record<string, unknown>,
  key: keyof ValidatedProduct,
  current: ValidatedProduct,
): number | null | undefined {
  const value = body[key];
  return typeof value === "number" || value === null
    ? value
    : (current[key] as number | null | undefined);
}

export function mergedProductUpdate(
  current: ValidatedProduct,
  body: Record<string, unknown>,
): ValidatedProduct {
  return {
    id: current.id,
    title: typeof body.title === "string" ? body.title : current.title,
    status: typeof body.status === "string" ? body.status : current.status,
    metadata:
      "metadata" in body
        ? {
            ...(current.metadata ?? {}),
            ...((body.metadata as Record<string, unknown> | null) ?? {}),
          }
        : current.metadata,
    weight: pickNumber(body, "weight", current),
    length: pickNumber(body, "length", current),
    width: pickNumber(body, "width", current),
    height: pickNumber(body, "height", current),
  };
}

export function validateProductUpdate() {
  return async (
    req: MedusaRequest,
    _res: MedusaResponse,
    next: MedusaNextFunction,
  ) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      if (!touchesGuardedFields(body)) return next();

      const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
      const { data } = await query.graph({
        entity: "product",
        fields: PRODUCT_VALIDATION_FIELDS,
        filters: { id: req.params.id },
      });

      const current = data[0] as ValidatedProduct | undefined;
      if (!current) return next();

      const merged = mergedProductUpdate(current, body);
      assertPublishableProducts([merged]);
      assertDeclaredCustomization([merged]);

      return next();
    } catch (error) {
      return next(error);
    }
  };
}

export const productValidationMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/admin/products/:id",
    method: "POST",
    middlewares: [validateProductUpdate()],
  },
];
