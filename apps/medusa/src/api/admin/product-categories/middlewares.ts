import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
  MiddlewareRoute,
} from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

import {
  assertCategoryArtwork,
  type CategoryArtworkInput,
} from "../../../lib/category-artwork";

export const CATEGORY_VALIDATION_FIELDS = ["id", "metadata"];

export function mergedCategoryUpdate(
  current: CategoryArtworkInput,
  body: Record<string, unknown>,
): CategoryArtworkInput {
  return {
    id: current.id,
    // Medusa merges category metadata, so a patch of one key leaves the rest
    // in place — validating the body alone would miss what is already stored.
    metadata: {
      ...(current.metadata ?? {}),
      ...((body.metadata as Record<string, unknown> | null) ?? {}),
    },
  };
}

export function validateCategoryUpdate() {
  return async (
    req: MedusaRequest,
    _res: MedusaResponse,
    next: MedusaNextFunction,
  ) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      if (!("metadata" in body)) return next();

      const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
      const { data } = await query.graph({
        entity: "product_category",
        fields: CATEGORY_VALIDATION_FIELDS,
        filters: { id: req.params.id },
      });

      const current = data[0] as CategoryArtworkInput | undefined;
      if (!current) return next();

      assertCategoryArtwork([mergedCategoryUpdate(current, body)]);

      return next();
    } catch (error) {
      return next(error);
    }
  };
}

function validateCategoryCreate() {
  return async (
    req: MedusaRequest,
    _res: MedusaResponse,
    next: MedusaNextFunction,
  ) => {
    try {
      assertCategoryArtwork([(req.body ?? {}) as CategoryArtworkInput]);
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

export const categoryValidationMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/admin/product-categories",
    method: "POST",
    middlewares: [validateCategoryCreate()],
  },
  {
    matcher: "/admin/product-categories/:id",
    method: "POST",
    middlewares: [validateCategoryUpdate()],
  },
];
