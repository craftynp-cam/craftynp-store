import { authenticate } from "@medusajs/framework/http";
import type { MiddlewareRoute } from "@medusajs/framework/http";

export const adminSsoMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/admin-sso/link",
    method: "POST",
    middlewares: [
      authenticate("user", ["session", "bearer"], {
        allowUnregistered: true,
      }),
    ],
  },
];
