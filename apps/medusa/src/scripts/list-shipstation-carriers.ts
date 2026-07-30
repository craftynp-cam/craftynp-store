import type { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

type ShipStationCarrier = {
  carrier_id: string;
  carrier_code: string;
  friendly_name: string;
  nickname: string;
};

export default async function listShipStationCarriers({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

  const apiKey = process.env.SHIPSTATION_API_KEY;
  const baseUrl =
    process.env.SHIPSTATION_BASE_URL ?? "https://api.shipstation.com/v2";

  if (!apiKey) {
    logger.error("SHIPSTATION_API_KEY is not set.");
    return;
  }

  const response = await fetch(`${baseUrl}/carriers`, {
    headers: { "API-Key": apiKey },
  });

  if (!response.ok) {
    logger.error(`ShipStation responded ${response.status}`);
    return;
  }

  const body = (await response.json()) as { carriers?: ShipStationCarrier[] };

  for (const carrier of body.carriers ?? []) {
    logger.info(
      `${carrier.carrier_id}\t${carrier.carrier_code}\t${carrier.friendly_name} (${carrier.nickname})`,
    );
  }
}
