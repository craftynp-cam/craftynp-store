import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import type {
  Logger,
  INotificationModuleService,
} from "@medusajs/framework/types";
import { resolveSiteContent } from "@craftynp/types";

import { loadOrderConfirmation } from "../lib/order-confirmation";
import {
  ORDER_EMAIL_FAILED_LOG_TAG,
  orderConfirmationContent,
} from "../lib/order-email";
import { SITE_CONTENT_MODULE } from "../modules/site-content";
import type SiteContentModuleService from "../modules/site-content/service";

export default async function sendOrderConfirmationEmail({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);

  try {
    const loaded = await loadOrderConfirmation(container, event.data.id);
    if (!loaded?.order.email) return;

    const siteContent =
      container.resolve<SiteContentModuleService>(SITE_CONTENT_MODULE);
    const content = resolveSiteContent(
      await siteContent.listSiteContentEntries(),
    );

    const notification = container.resolve<INotificationModuleService>(
      Modules.NOTIFICATION,
    );

    await notification.createNotifications({
      to: loaded.order.email,
      channel: "email",
      trigger_type: "order.placed",
      resource_id: loaded.order.orderId,
      resource_type: "order",
      // Stops a duplicate receipt if order.placed is redelivered.
      idempotency_key: `order-confirmation:${loaded.order.orderId}`,
      content: orderConfirmationContent(loaded.order, {
        turnaroundNote: content.order_turnaround_note,
        shippingWindowNote: content.order_shipping_window_note,
      }),
    });
  } catch (error) {
    // Never rethrow: the order is paid and placed, and a failed receipt must
    // not roll it back. The notification row is already marked FAILURE, which
    // is what the retry job reads.
    logger.error(
      `${ORDER_EMAIL_FAILED_LOG_TAG} kind=confirmation order=${event.data.id} error=${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
};
