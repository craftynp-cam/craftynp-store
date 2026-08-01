import type { MedusaContainer } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import {
  createDefaultsWorkflow,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows";

function required<T>(value: T | undefined, name: string): T {
  if (!value) {
    throw new Error(`Seed failed: expected ${name} to be created.`);
  }

  return value;
}

export default async function seed_defaults({
  container,
}: {
  container: MedusaContainer;
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  logger.info("Seeding the default sales channel, store, and API key...");
  await createDefaultsWorkflow(container).run();

  const { data: stores } = await query.graph({
    entity: "store",
    fields: ["id", "supported_currencies.currency_code"],
  });
  const store = required(stores[0], "default store");

  const currencies: string[] = (store.supported_currencies ?? []).map(
    (currency: { currency_code: string }) => currency.currency_code,
  );

  if (currencies.length !== 1 || currencies[0] !== "usd") {
    logger.info("Setting the store's supported currency to USD...");
    await updateStoresWorkflow(container).run({
      input: {
        selector: { id: store.id },
        update: {
          supported_currencies: [{ currency_code: "usd", is_default: true }],
        },
      },
    });
  }

  const { data: apiKeys } = await query.graph({
    entity: "api_key",
    fields: ["id", "token"],
    filters: { type: "publishable" },
  });
  const publishableApiKey = required(apiKeys[0], "publishable API key");

  logger.info(`Publishable API key: ${publishableApiKey.token}`);
}
