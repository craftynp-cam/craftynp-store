import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { Logger } from "@medusajs/framework/types";
import {
  addShippingMethodToCartWorkflow,
  createCartWorkflow,
  createPaymentCollectionForCartWorkflow,
  createPaymentSessionsWorkflow,
  updateCartWorkflow,
} from "@medusajs/medusa/core-flows";
import type { CheckoutAddress, CheckoutPrepareRequest } from "@craftynp/types";

import { cartSignature, verifyShippingQuote } from "../../../../lib/shipping-quote";
import { taxSignature, verifyTaxQuote } from "../../../../lib/tax-quote";

const STRIPE_PAYMENT_PROVIDER_ID = "pp_stripe_stripe";
const LIVE_SHIPPING_OPTION_NAME = "Live USPS Rate";

type RegionWithCountries = {
  id: string;
  currency_code: string;
  countries?: ({ iso_2: string | null } | null)[] | null;
};

function selectRegionForCountry(
  regions: readonly RegionWithCountries[],
  countryCode: string,
): RegionWithCountries | null {
  const wanted = countryCode.toLowerCase();
  const match = regions.find((region) =>
    region.countries?.some(
      (country) => country?.iso_2?.toLowerCase() === wanted,
    ),
  );
  return match ?? regions[0] ?? null;
}

function toCartAddress(address: CheckoutAddress) {
  return {
    first_name: address.firstName,
    last_name: address.lastName,
    phone: address.phone,
    address_1: address.address1,
    address_2: address.address2,
    city: address.city,
    province: address.state,
    postal_code: address.postalCode,
    country_code: address.countryCode.toLowerCase(),
  };
}

type PaymentSessionWithData = {
  id: string;
  provider_id: string;
  data?: { client_secret?: string } | null;
};

type CartWithRelations = {
  id: string;
  completed_at?: string | Date | null;
  shipping_methods?: { id: string }[] | null;
  payment_collection?: {
    id: string;
    payment_sessions?: PaymentSessionWithData[] | null;
  } | null;
};

export async function POST(
  req: MedusaRequest<CheckoutPrepareRequest>,
  res: MedusaResponse,
) {
  const logger = req.scope.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const {
    cartId,
    email,
    shippingAddress,
    billingAddress,
    items,
    shippingRateId,
    shippingServiceCode,
    shippingQuoteToken,
    taxQuoteToken,
  } = req.validatedBody;

  const shippingItems = items.map((item) => ({
    variantId: item.variantId,
    quantity: item.quantity,
  }));

  const shippingCartSig = cartSignature({
    items: shippingItems,
    postalCode: shippingAddress.postalCode,
    countryCode: shippingAddress.countryCode,
  });
  const shippingResult = verifyShippingQuote(
    shippingQuoteToken,
    process.env.SHIPPING_QUOTE_SECRET as string,
    { cartSignature: shippingCartSig },
  );

  if (!shippingResult.valid) {
    return res.status(400).json({
      error: "invalid_shipping_quote",
      reason: shippingResult.reason,
    });
  }

  const taxSig = taxSignature({
    items: shippingItems,
    postalCode: shippingAddress.postalCode,
    countryCode: shippingAddress.countryCode,
    state: shippingAddress.state,
    city: shippingAddress.city,
    shippingAmount: shippingResult.payload.amt,
  });
  const taxResult = verifyTaxQuote(
    taxQuoteToken,
    process.env.TAX_QUOTE_SECRET as string,
    { taxSignature: taxSig },
  );

  if (!taxResult.valid) {
    return res.status(400).json({
      error: "invalid_tax_quote",
      reason: taxResult.reason,
    });
  }

  const { data: regions } = await query.graph({
    entity: "region",
    fields: ["id", "currency_code", "countries.iso_2"],
    filters: {},
  });
  const region = selectRegionForCountry(
    regions as RegionWithCountries[],
    shippingAddress.countryCode,
  );

  const { data: shippingOptions } = await query.graph({
    entity: "shipping_option",
    fields: ["id"],
    filters: { name: LIVE_SHIPPING_OPTION_NAME },
  });
  const shippingOption = shippingOptions[0];

  if (!region || !shippingOption) {
    logger.error(
      `[checkout:unavailable] reason=misconfigured postal=${shippingAddress.postalCode}`,
    );
    return res
      .status(502)
      .json({ error: "checkout_unavailable", reason: "misconfigured" });
  }

  let cart: CartWithRelations;

  if (cartId) {
    const { data: existingCarts } = await query.graph({
      entity: "cart",
      fields: [
        "id",
        "completed_at",
        "shipping_methods.id",
        "payment_collection.id",
        "payment_collection.payment_sessions.id",
        "payment_collection.payment_sessions.provider_id",
        "payment_collection.payment_sessions.data",
      ],
      filters: { id: cartId },
    });
    const existingCart = existingCarts[0] as CartWithRelations | undefined;

    if (!existingCart) {
      return res.status(400).json({ error: "invalid_cart" });
    }
    if (existingCart.completed_at) {
      return res.status(400).json({ error: "cart_already_completed" });
    }

    await updateCartWorkflow(req.scope).run({
      input: {
        id: existingCart.id,
        region_id: region.id,
        email,
        shipping_address: toCartAddress(shippingAddress),
        billing_address: toCartAddress(billingAddress),
      },
    });

    cart = existingCart;
  } else {
    const { result: createdCart } = await createCartWorkflow(req.scope).run({
      input: {
        region_id: region.id,
        email,
        shipping_address: toCartAddress(shippingAddress),
        billing_address: toCartAddress(billingAddress),
        items: items.map((item) => ({
          variant_id: item.variantId,
          quantity: item.quantity,
          metadata: {
            isCustomizable: item.isCustomizable ?? false,
            details: item.details ?? [],
          },
        })),
      },
    });

    cart = createdCart as CartWithRelations;
  }

  if (!cart.shipping_methods || cart.shipping_methods.length === 0) {
    await addShippingMethodToCartWorkflow(req.scope).run({
      input: {
        cart_id: cart.id,
        options: [
          {
            id: shippingOption.id,
            data: {
              rateId: shippingRateId,
              serviceCode: shippingServiceCode,
              quoteToken: shippingQuoteToken,
              amount: shippingResult.payload.amt,
            },
          },
        ],
      },
    });
  }

  let paymentCollectionId = cart.payment_collection?.id;
  if (!paymentCollectionId) {
    const { result: paymentCollection } =
      await createPaymentCollectionForCartWorkflow(req.scope).run({
        input: { cart_id: cart.id },
      });
    paymentCollectionId = (paymentCollection as { id: string }).id;
  }

  const existingSession = cart.payment_collection?.payment_sessions?.find(
    (session) => session.provider_id === STRIPE_PAYMENT_PROVIDER_ID,
  );

  let clientSecret = existingSession?.data?.client_secret;

  if (!clientSecret) {
    const { result: paymentSession } = await createPaymentSessionsWorkflow(
      req.scope,
    ).run({
      input: {
        payment_collection_id: paymentCollectionId,
        provider_id: STRIPE_PAYMENT_PROVIDER_ID,
      },
    });
    clientSecret = (paymentSession as PaymentSessionWithData).data
      ?.client_secret;
  }

  if (!clientSecret) {
    logger.error(`[checkout:unavailable] reason=no_client_secret cart=${cart.id}`);
    return res
      .status(502)
      .json({ error: "checkout_unavailable", reason: "payment_unavailable" });
  }

  const { data: refreshedCarts } = await query.graph({
    entity: "cart",
    fields: [
      "id",
      "currency_code",
      "item_subtotal",
      "shipping_subtotal",
      "tax_total",
      "total",
    ],
    filters: { id: cart.id },
  });
  const refreshed = refreshedCarts[0] as {
    id: string;
    currency_code: string;
    item_subtotal: number;
    shipping_subtotal: number;
    tax_total: number;
    total: number;
  };

  return res.json({
    cartId: cart.id,
    clientSecret,
    totals: {
      subtotal: refreshed.item_subtotal,
      shipping: refreshed.shipping_subtotal,
      tax: refreshed.tax_total,
      total: refreshed.total,
      currencyCode: refreshed.currency_code,
    },
  });
}
