import { authenticate } from "@medusajs/framework/http";
import type { MiddlewareRoute } from "@medusajs/framework/http";

export const orderConfirmationMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/store/order-confirmation/*",
    method: "GET",
    middlewares: [
      authenticate("customer", ["session", "bearer"], {
        allowUnauthenticated: true,
      }),
    ],
  },
];
