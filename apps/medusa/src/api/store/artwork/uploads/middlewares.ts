import { validateAndTransformBody } from "@medusajs/framework/http";
import type { MiddlewareRoute } from "@medusajs/framework/http";
import { artworkUploadRequestSchema } from "@craftynp/types";

import { rateLimit, ruleFromEnv } from "../../../../lib/rate-limit";

const validatedBodySchema = artworkUploadRequestSchema as unknown as Parameters<
  typeof validateAndTransformBody
>[0];

export const artworkUploadMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/store/artwork/uploads",
    method: "POST",
    middlewares: [
      rateLimit(
        ruleFromEnv(
          "artwork-upload",
          "RATE_LIMIT_ARTWORK_UPLOAD_PER_MINUTE",
          10,
        ),
      ),
      validateAndTransformBody(validatedBodySchema),
    ],
  },
  {
    matcher: "/store/artwork/uploads/:uploadId/inspect",
    method: "POST",
    middlewares: [
      rateLimit(
        ruleFromEnv(
          "artwork-inspect",
          "RATE_LIMIT_ARTWORK_INSPECT_PER_MINUTE",
          20,
        ),
      ),
    ],
  },
];
