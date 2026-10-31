import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
  MiddlewareRoute,
} from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

import {
  PRODUCT_OPTION_FIELDS,
  assertCustomSizeOption,
  assertDeclaredCustomization,
  type ProductWithOptionsInput,
} from "../../../lib/product-customization";
type ValidatedProduct = ProductWithOptionsInput;

const GUARDED_KEYS = ["metadata", "status", "title"] as const;

export const PRODUCT_VALIDATION_FIELDS = [
  "id",
  ...GUARDED_KEYS,
  ...PRODUCT_OPTION_FIELDS,
];

export function touchesGuardedFields(body: Record<string, unknown>): boolean {
  return GUARDED_KEYS.some((key) => key in body);
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
    product_options: current.product_options,
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
      assertDeclaredCustomization([merged]);
      assertCustomSizeOption([merged]);

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
