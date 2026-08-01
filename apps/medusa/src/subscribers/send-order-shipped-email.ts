import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import {
  ContainerRegistrationKeys,
  FulfillmentWorkflowEvents,
  Modules,
} from "@medusajs/framework/utils";
import type {
  Logger,
  INotificationModuleService,
} from "@medusajs/framework/types";

import { loadOrderConfirmation } from "../lib/order-confirmation";
import {
  formatOrderDate,
  ORDER_EMAIL_FAILED_LOG_TAG,
  orderShippedContent,
} from "../lib/order-email";

type ShipmentEvent = { id: string; no_notification?: boolean };

type FulfillmentRow = {
  shipped_at?: string | null;
  labels?: {
    tracking_number: string | null;
    tracking_url: string | null;
  }[];
  shipping_option?: { name: string | null } | null;
};

export default async function sendOrderShippedEmail({
  event,
  container,
}: SubscriberArgs<ShipmentEvent>) {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);

  if (event.data.no_notification) return;

  const fulfillmentId = event.data.id;

  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY);

    const { data: links } = await query.graph({
      entity: "order_fulfillment",
      fields: ["order_id"],
      filters: { fulfillment_id: fulfillmentId },
    });

    const orderId = (links[0] as { order_id?: string } | undefined)?.order_id;
    if (!orderId) return;

    const loaded = await loadOrderConfirmation(container, orderId);
    if (!loaded?.order.email) return;

    const { data: fulfillments } = await query.graph({
      entity: "fulfillment",
      fields: [
        "shipped_at",
        "labels.tracking_number",
        "labels.tracking_url",
        "shipping_option.name",
      ],
      filters: { id: fulfillmentId },
    });

    const fulfillment = fulfillments[0] as FulfillmentRow | undefined;
    const label = fulfillment?.labels?.[0];

    const notification = container.resolve<INotificationModuleService>(
      Modules.NOTIFICATION,
    );

    await notification.createNotifications({
      to: loaded.order.email,
      channel: "email",
      trigger_type: FulfillmentWorkflowEvents.SHIPMENT_CREATED,
      resource_id: loaded.order.orderId,
      resource_type: "order",
      idempotency_key: `order-shipped:${fulfillmentId}`,
      content: orderShippedContent(loaded.order, {
        carrierName:
          fulfillment?.shipping_option?.name ??
          loaded.order.shippingMethodName ??
          "the carrier",
        trackingNumber: label?.tracking_number ?? "",
        trackingUrl: label?.tracking_url ?? "",
        shipDate: formatOrderDate(fulfillment?.shipped_at ?? ""),
      }),
    });
  } catch (error) {
    logger.error(
      `${ORDER_EMAIL_FAILED_LOG_TAG} kind=shipped fulfillment=${fulfillmentId} error=${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

export const config: SubscriberConfig = {
  event: FulfillmentWorkflowEvents.SHIPMENT_CREATED,
};
