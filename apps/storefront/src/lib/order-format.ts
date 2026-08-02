import type { OrderConfirmation } from "@craftynp/types";

export function formatOrderDate(isoDate: string): string {
  if (!isoDate) return "";

  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function orderReference(displayId: number): string {
  return `#CNP-${displayId}`;
}

export function hasCustomLine(order: OrderConfirmation): boolean {
  return order.lines.some((line) => line.isCustomizable);
}
