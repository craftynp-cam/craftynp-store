import type { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

import { SHIPSTATION_MODULE } from "../modules/shipstation";
import type ShipStationModuleService from "../modules/shipstation/service";

export default async function registerShipStationWebhook({
  container,
}: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

  const url = process.env.SHIPSTATION_WEBHOOK_URL;

  if (!url) {
    logger.error(
      "SHIPSTATION_WEBHOOK_URL is not set. It must be the publicly reachable https URL of /hooks/shipstation/track.",
    );
    return;
  }

  if (!url.startsWith("https://")) {
    logger.error(
      `SHIPSTATION_WEBHOOK_URL must be https, got ${url}. ShipStation will not deliver to a plain-http or localhost endpoint — use a tunnel while developing.`,
    );
    return;
  }

  const shipstation =
    container.resolve<ShipStationModuleService>(SHIPSTATION_MODULE);

  try {
    const result = await shipstation.registerTrackingWebhook(url);

    if (result.created) {
      logger.info(`Registered the ShipStation track webhook at ${url}.`);
      return;
    }

    logger.info(
      `A track webhook is already registered. ShipStation allows one URL per event, so delete the existing subscription first if ${url} is not it.`,
    );
  } catch (error) {
    logger.error(
      `Could not register the track webhook: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
