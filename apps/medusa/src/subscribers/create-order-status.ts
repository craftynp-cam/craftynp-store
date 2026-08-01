import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { Logger } from "@medusajs/framework/types";

import { ORDER_STATUS_MODULE } from "../modules/order-status";
import { ORDER_STATUS_LOG_TAG } from "../modules/order-status/lib";
import type OrderStatusModuleService from "../modules/order-status/service";

export default async function createOrderStatusHandler({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const service =
    container.resolve<OrderStatusModuleService>(ORDER_STATUS_MODULE);

  try {
    await service.ensureRecord(event.data.id);
  } catch (error) {
    logger.error(
      `${ORDER_STATUS_LOG_TAG} reason=create_failed order=${event.data.id} error=${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
};
