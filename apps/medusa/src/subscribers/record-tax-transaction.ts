import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { Logger } from "@medusajs/framework/types";

import { STRIPE_TAX_MODULE } from "../modules/stripe-tax";
import { STRIPE_TAX_UNAVAILABLE_LOG_TAG } from "../modules/stripe-tax/lib";
import type StripeTaxModuleService from "../modules/stripe-tax/service";

type OrderForTaxTransaction = {
  id: string;
  currency_code: string;
  shipping_address?: {
    country_code: string | null;
    postal_code: string | null;
    city: string | null;
    province: string | null;
  } | null;
  items?: {
    variant_id: string | null;
    unit_price: number | null;
    quantity: number | null;
  }[];
  shipping_methods?: { amount: number | null }[];
};

/**
 * Records the order's sale in Stripe's own tax reports (AC5's `cid` note).
 * CNP-52 deliberately stopped short of this call — recording a transaction
 * belongs to order placement, which is here for the first time.
 *
 * Rather than plumbing the checkout-time calculation id through the cart
 * pipeline (nothing in Medusa's own tax provider context carries a cart id
 * — see stripe-tax/tax-provider.ts), this recomputes the same calculation
 * from the placed order's own line items, shipping amount, and address.
 * StripeTaxModuleService.calculateTax caches on exactly those inputs, so an
 * order placed shortly after its cart's tax was quoted reuses the cached
 * calculation rather than paying for a second Stripe call.
 */
export default async function recordTaxTransactionHandler({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const stripeTax =
    container.resolve<StripeTaxModuleService>(STRIPE_TAX_MODULE);

  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "currency_code",
      "shipping_address.country_code",
      "shipping_address.postal_code",
      "shipping_address.city",
      "shipping_address.province",
      "items.variant_id",
      "items.unit_price",
      "items.quantity",
      "shipping_methods.amount",
    ],
    filters: { id: event.data.id },
  });

  const order = orders[0] as OrderForTaxTransaction | undefined;
  if (!order) return;

  const address = order.shipping_address;
  if (!address?.country_code) return;

  const lineItems = (order.items ?? [])
    .filter((item) => item.variant_id)
    .map((item) => ({
      reference: item.variant_id as string,
      amount: item.unit_price ?? 0,
      quantity: item.quantity ?? 1,
    }));

  if (lineItems.length === 0) return;

  const shippingAmount = (order.shipping_methods ?? []).reduce(
    (sum, method) => sum + (method.amount ?? 0),
    0,
  );

  try {
    const calculation = await stripeTax.calculateTax({
      currencyCode: order.currency_code,
      destination: {
        countryCode: address.country_code,
        postalCode: address.postal_code ?? "",
        city: address.city ?? "",
        state: address.province ?? "",
      },
      lineItems,
      shippingAmount,
    });

    await stripeTax.recordTransaction(calculation.calculationId, order.id);
  } catch (error) {
    logger.error(
      `${STRIPE_TAX_UNAVAILABLE_LOG_TAG} reason=transaction_failed order=${order.id} error=${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
};
