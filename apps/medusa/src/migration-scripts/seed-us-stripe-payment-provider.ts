import type { MedusaContainer } from "@medusajs/framework";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import {
  createShippingOptionsWorkflow,
  updateRegionsWorkflow,
  updateTaxRegionsWorkflow,
} from "@medusajs/medusa/core-flows";

const STRIPE_PAYMENT_PROVIDER_ID = "pp_stripe_stripe";
const STRIPE_TAX_PROVIDER_ID = "tp_stripe-tax_stripe";
const SHIPSTATION_LIVE_RATE_PROVIDER_ID = "shipstation_shipstation";
const LIVE_SHIPPING_OPTION_NAME = "Live USPS Rate";

function required<T>(value: T | undefined, name: string): T {
  if (!value) {
    throw new Error(`Seed failed: expected ${name} to be found.`);
  }
  return value;
}

/**
 * CNP-53 teaches the United States region seeded by seed-us-region.ts (CNP-51)
 * about the three providers registered in medusa-config.ts: Stripe for
 * payment, the ShipStation fulfillment provider for a real calculated
 * shipping option, and Stripe Tax as the region's tax provider (swapped in
 * place of the system provider seed-us-region.ts started it with). A new
 * file, never an edit to seed-us-region.ts — the migration ledger tracks
 * each script independently, so a new file still runs against a database
 * that already migrated.
 */
export default async function seed_stripe_payment_provider({
  container,
}: {
  container: MedusaContainer;
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const link = container.resolve(ContainerRegistrationKeys.LINK);

  const { data: existingOptions } = await query.graph({
    entity: "shipping_option",
    fields: ["id"],
    filters: { name: LIVE_SHIPPING_OPTION_NAME },
  });

  if (existingOptions.length > 0) {
    logger.info("Stripe payment provider already seeded, skipping.");
    return;
  }

  const { data: regions } = await query.graph({
    entity: "region",
    fields: ["id", "payment_providers.id"],
    filters: { name: "United States" },
  });
  const region = required(regions[0], "United States region");

  const { data: taxRegions } = await query.graph({
    entity: "tax_region",
    fields: ["id", "country_code"],
    filters: { country_code: "us" },
  });
  const taxRegion = required(taxRegions[0], "United States tax region");

  const { data: serviceZones } = await query.graph({
    entity: "service_zone",
    fields: ["id", "name", "fulfillment_set_id", "shipping_options.id"],
    filters: { name: "United States" },
  });
  const serviceZone = required(serviceZones[0], "US fulfillment service zone");

  const { data: shippingProfiles } = await query.graph({
    entity: "shipping_profile",
    fields: ["id"],
  });
  const shippingProfile = required(
    shippingProfiles[0],
    "default shipping profile",
  );

  const { data: stockLocations } = await query.graph({
    entity: "stock_location",
    fields: ["id"],
    filters: { name: "US Workshop" },
  });
  const stockLocation = required(
    stockLocations[0],
    "US Workshop stock location",
  );

  logger.info(
    "Enabling the ShipStation fulfillment provider for the US Workshop location...",
  );
  await link.create({
    [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
    [Modules.FULFILLMENT]: {
      fulfillment_provider_id: SHIPSTATION_LIVE_RATE_PROVIDER_ID,
    },
  });

  logger.info(
    "Attaching Stripe payment provider to the United States region...",
  );
  const existingPaymentProviderIds =
    (region.payment_providers as { id: string }[] | undefined)?.map(
      (provider) => provider.id,
    ) ?? [];
  await updateRegionsWorkflow(container).run({
    input: {
      selector: { id: region.id },
      update: {
        payment_providers: Array.from(
          new Set([...existingPaymentProviderIds, STRIPE_PAYMENT_PROVIDER_ID]),
        ),
      },
    },
  });

  logger.info("Switching the United States tax region to Stripe Tax...");
  await updateTaxRegionsWorkflow(container).run({
    input: [{ id: taxRegion.id, provider_id: STRIPE_TAX_PROVIDER_ID }],
  });

  logger.info("Adding a live-rate shipping option for the United States...");
  await createShippingOptionsWorkflow(container).run({
    input: [
      {
        name: LIVE_SHIPPING_OPTION_NAME,
        price_type: "calculated",
        provider_id: SHIPSTATION_LIVE_RATE_PROVIDER_ID,
        service_zone_id: serviceZone.id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Live USPS rate",
          description: "Calculated live from USPS via ShipStation.",
          code: "live-usps",
        },
        rules: [
          { attribute: "enabled_in_store", value: "true", operator: "eq" },
          { attribute: "is_return", value: "false", operator: "eq" },
        ],
      },
    ],
  });

  logger.info("Finished seeding the Stripe payment provider.");
}
