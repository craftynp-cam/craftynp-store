import type { OrderStatus } from "@craftynp/types";

import { ORDER_STATUS_COPY } from "@/lib/order-status";

import { Badge } from "../ui";

export type OrderStatusBadgeProps = {
  status: OrderStatus;
};

export function OrderStatusBadge({ status }: OrderStatusBadgeProps) {
  const { label, tone } = ORDER_STATUS_COPY[status];

  return <Badge tone={tone}>{label}</Badge>;
}
