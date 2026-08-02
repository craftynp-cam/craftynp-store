import type { MedusaContainer } from "@medusajs/framework";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import {
  createRegionsWorkflow,
  createShippingOptionsWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
} from "@medusajs/medusa/core-flows";

function required<T>(value: T | undefined, name: string): T {
  if (!value) {
    throw new Error(`Seed failed: expected ${name} to be created.`);
  }

  return value;
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Seed failed: ${name} is not set.`);
  }

  return value;
}

export default async function seed_us_region({
  container,
}: {
  container: MedusaContainer;
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  const { data: existingRegions } = await query.graph({
    entity: "region",
    fields: ["id"],
    filters: { name: "United States" },
  });

  if (existingRegions.length > 0) {
    logger.info("United States region already seeded, skipping.");
    return;
  }

  logger.info("Seeding United States region...");
  const { result: regionResult } = await createRegionsWorkflow(container).run({
    input: {
      regions: [
        {
          name: "United States",
          currency_code: "usd",
          countries: ["us"],
          payment_providers: ["pp_system_default"],
        },
      ],
    },
  });
  const region = required(regionResult[0], "United States region");

  await createTaxRegionsWorkflow(container).run({
    input: [{ country_code: "us", provider_id: "tp_system" }],
  });

  const { data: shippingProfileResult } = await query.graph({
    entity: "shipping_profile",
    fields: ["id"],
  });
  const shippingProfile = required(
    shippingProfileResult[0],
    "default shipping profile",
  );

  const { data: salesChannelResult } = await query.graph({
    entity: "sales_channel",
    fields: ["id"],
    filters: { name: "Default Sales Channel" },
  });
  const defaultSalesChannel = required(
    salesChannelResult[0],
    "default sales channel",
  );

  logger.info("Seeding US Workshop stock location...");
  const { result: stockLocationResult } = await createStockLocationsWorkflow(
    container,
  ).run({
    input: {
      locations: [
        {
          name: "US Workshop",
          address: {
            address_1: requiredEnv("SHIP_FROM_ADDRESS_1"),
            city: requiredEnv("SHIP_FROM_CITY"),
            province: requiredEnv("SHIP_FROM_STATE"),
            postal_code: requiredEnv("SHIP_FROM_POSTAL_CODE"),
            country_code: requiredEnv("SHIP_FROM_COUNTRY_CODE").toLowerCase(),
          },
        },
      ],
    },
  });
  const stockLocation = required(stockLocationResult[0], "US stock location");

  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT);

  await link.create({
    [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
    [Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
  });

  const fulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
    name: "US Workshop delivery",
    type: "shipping",
    service_zones: [
      {
        name: "United States",
        geo_zones: [{ country_code: "us", type: "country" }],
      },
    ],
  });

  await link.create({
    [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
    [Modules.FULFILLMENT]: { fulfillment_set_id: fulfillmentSet.id },
  });

  const serviceZone = required(
    fulfillmentSet.service_zones[0],
    "US fulfillment service zone",
  );

  const defaultAmount = Number(requiredEnv("SHIPPING_OPTION_DEFAULT_AMOUNT"));
  const defaultLabel = requiredEnv("SHIPPING_OPTION_DEFAULT_LABEL");

  await createShippingOptionsWorkflow(container).run({
    input: [
      {
        name: "Standard Shipping",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: serviceZone.id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: defaultLabel,
          description: "Ships via USPS.",
          code: "standard",
        },
        prices: [
          { currency_code: "usd", amount: defaultAmount },
          { region_id: region.id, amount: defaultAmount },
        ],
        rules: [
          { attribute: "enabled_in_store", value: "true", operator: "eq" },
          { attribute: "is_return", value: "false", operator: "eq" },
        ],
      },
    ],
  });

  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: {
      id: stockLocation.id,
      add: [defaultSalesChannel.id],
    },
  });

  logger.info("Finished seeding the United States region.");
}
