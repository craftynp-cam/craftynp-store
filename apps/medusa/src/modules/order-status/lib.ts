import { createHash } from "node:crypto";

import { transitionRejection } from "@craftynp/types";
import type { OrderStatus } from "@craftynp/types";

export const ORDER_STATUS_LOG_TAG = "[order-status]";
export const TRACKING_WEBHOOK_LOG_TAG = "[shipstation:track]";

export type OrderStatusErrorReason =
  "invalid_transition" | "unknown_order" | "no_shipment";

export class OrderStatusTransitionError extends Error {
  reason: OrderStatusErrorReason;

  constructor(reason: OrderStatusErrorReason, message?: string) {
    super(message ?? reason);
    this.name = "OrderStatusTransitionError";
    this.reason = reason;
  }
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  const rejection = transitionRejection(from, to);
  if (rejection) {
    throw new OrderStatusTransitionError("invalid_transition", rejection);
  }
}

export type TrackingWebhookPayload = {
  trackingNumber: string;
  statusCode: string;
  statusDescription: string | null;
  carrierStatusCode: string | null;
  carrierStatusDescription: string | null;
  occurredAt: string | null;
};

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function latestEventTimestamp(events: unknown): string | null {
  if (!Array.isArray(events)) return null;

  let latest: number | null = null;
  let latestRaw: string | null = null;

  for (const event of events) {
    if (event == null || typeof event !== "object") continue;
    const raw = asString((event as Record<string, unknown>).occurred_at);
    if (!raw) continue;
    const parsed = Date.parse(raw);
    if (Number.isNaN(parsed)) continue;
    if (latest == null || parsed > latest) {
      latest = parsed;
      latestRaw = raw;
    }
  }

  return latestRaw;
}

export function parseTrackingWebhook(
  body: unknown,
): TrackingWebhookPayload | null {
  if (body == null || typeof body !== "object") return null;

  const envelope = body as Record<string, unknown>;
  const data = envelope.data;
  if (data == null || typeof data !== "object") return null;

  const record = data as Record<string, unknown>;
  const trackingNumber = asString(record.tracking_number);
  const statusCode = asString(record.status_code);
  if (!trackingNumber || !statusCode) return null;

  return {
    trackingNumber,
    statusCode: statusCode.toUpperCase(),
    statusDescription: asString(record.status_description),
    carrierStatusCode: asString(record.carrier_status_code),
    carrierStatusDescription: asString(record.carrier_status_description),
    occurredAt:
      latestEventTimestamp(record.events) ?? asString(record.occurred_at),
  };
}

export function payloadDigest(rawBody: string): string {
  return createHash("sha256").update(rawBody).digest("hex").slice(0, 32);
}

export function trackingEventKey(
  payload: TrackingWebhookPayload,
  rawBody: string,
): string {
  const discriminator = payload.occurredAt ?? payloadDigest(rawBody);
  return `${payload.trackingNumber}:${payload.statusCode}:${discriminator}`;
}
