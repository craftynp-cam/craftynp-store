import type { MedusaContainer } from "@medusajs/framework";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

import { FLAT_RATE_SHIPPING_OPTION_NAME } from "../lib/flat-shipping";

const PREVIOUS_SHIPPING_OPTION_NAME = "Live USPS Rate";

export default async function update_shipping_option_flat_rate({
  container,
}: {
  container: MedusaContainer;
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const fulfillment = container.resolve(Modules.FULFILLMENT);

  const options = await fulfillment.listShippingOptions({
    name: PREVIOUS_SHIPPING_OPTION_NAME,
  });

  if (options.length === 0) {
    logger.info("No live-rate shipping option to rename, skipping.");
    return;
  }

  for (const option of options) {
    await fulfillment.updateShippingOptions(option.id, {
      name: FLAT_RATE_SHIPPING_OPTION_NAME,
    });
  }

  logger.info(
    `Renamed ${options.length} shipping option(s) to "${FLAT_RATE_SHIPPING_OPTION_NAME}".`,
  );
}
