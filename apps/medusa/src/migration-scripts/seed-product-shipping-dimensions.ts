import type { MedusaContainer } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows";

const DIMENSIONS_CM: Record<
  string,
  { length: number; width: number; height: number }
> = {
  "t-shirt": { length: 30, width: 25, height: 3 },
  sweatshirt: { length: 35, width: 30, height: 5 },
  sweatpants: { length: 35, width: 30, height: 5 },
  shorts: { length: 30, width: 25, height: 3 },
};

export default async function seed_product_shipping_dimensions({
  container,
}: {
  container: MedusaContainer;
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "length", "width", "height"],
    filters: { handle: Object.keys(DIMENSIONS_CM) },
  });

  const toUpdate = products.filter(
    (product) =>
      DIMENSIONS_CM[product.handle ?? ""] &&
      (product.length == null ||
        product.width == null ||
        product.height == null),
  );

  if (toUpdate.length === 0) {
    logger.info("All seeded products already carry shipping dimensions.");
    return;
  }

  await updateProductsWorkflow(container).run({
    input: {
      products: toUpdate.map((product) => ({
        id: product.id,
        ...DIMENSIONS_CM[product.handle as string],
      })),
    },
  });

  logger.info(
    `Backfilled shipping dimensions for ${toUpdate.length} seeded product(s).`,
  );
}
