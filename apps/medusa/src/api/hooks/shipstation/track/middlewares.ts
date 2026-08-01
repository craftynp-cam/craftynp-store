import type { MiddlewareRoute } from "@medusajs/framework/http";

export const shipstationTrackMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    bodyParser: { preserveRawBody: true },
    matcher: "/hooks/shipstation/track",
  },
];
