import { authenticate } from "@medusajs/framework/http";
import type { MiddlewareRoute } from "@medusajs/framework/http";

export const orderConfirmationMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/store/order-confirmation/*",
    method: "GET",
    // Unauthenticated has to be allowed or the guest token branch never runs,
    // while a signed-in customer still gets req.auth_context populated so the
    // route can match the order's own customer_id.
    middlewares: [
      authenticate("customer", ["session", "bearer"], {
        allowUnauthenticated: true,
      }),
    ],
  },
];
