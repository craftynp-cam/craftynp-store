import { cache } from "react";

import type { OrderConfirmation } from "@craftynp/types";

import { sdk } from "./medusa";

type OrderConfirmationResponse = { order: OrderConfirmation };

export const fetchOrderConfirmation = cache(
  async (
    orderId: string,
    token: string | null,
    sessionToken?: string,
  ): Promise<OrderConfirmation | null> => {
    if (!orderId) return null;

    const query = token ? `?token=${encodeURIComponent(token)}` : "";

    try {
      const { order } = await sdk.client.fetch<OrderConfirmationResponse>(
        `/store/order-confirmation/${encodeURIComponent(orderId)}${query}`,
        {
          cache: "no-store",
          ...(sessionToken && !token
            ? { headers: { Authorization: `Bearer ${sessionToken}` } }
            : {}),
        },
      );
      return order;
    } catch (error) {
      console.error("Could not load the order confirmation", error);
      return null;
    }
  },
);
