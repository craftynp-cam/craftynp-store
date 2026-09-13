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
import { formatCheckoutLineRefusals, lineItemDetails } from "@craftynp/types";
import type {
  CheckoutAddress,
  CheckoutLineItemDetail,
  CheckoutLineRefusal,
  CheckoutPrepareRequest,
  LineItemCustomization,
} from "@craftynp/types";

import {
  cartSignature,
  verifyShippingQuote,
} from "../../../../lib/shipping-quote";
import { taxSignature, verifyTaxQuote } from "../../../../lib/tax-quote";
import { describeError } from "../../../../lib/describe-error";
import { toAmount } from "../../../../lib/money";
import { priceSignature, verifyPriceQuote } from "../../../../lib/price-quote";
import { resolveLinePrice } from "../../../../lib/resolve-line-price";
import { artworkFromLedger } from "../../../../lib/artwork-ledger";
import { ARTWORK_MODULE } from "../../../../modules/artwork";
import type ArtworkModuleService from "../../../../modules/artwork/service";
import type { ArtworkAssetRow } from "../../../../modules/artwork/service";
import { pricedVariantQuery } from "../../price-quote/route";
import {
  VARIANT_CUSTOMIZATION_FIELDS,
  customizationRulesForVariant,
  orderLineFactsForVariant,
  type VariantWithCustomization,
} from "../../../../lib/customization-rules";
import {
  CustomizationRejection,
  validateCustomization,
} from "../../../../lib/validate-customization";

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

type CartItemRow = {
  variant_id?: string | null;
  quantity?: unknown;
  unit_price?: unknown;
  is_custom_price?: boolean | null;
  metadata?: {
    dimensions?: { widthInches?: number; heightInches?: number } | null;
    customization?: LineItemCustomization | null;
  } | null;
};

type CartWithItems = {
  id: string;
  completed_at?: string | Date | null;
  items?: CartItemRow[] | null;
};

// updateCartWorkflow cannot change line items, so anything that alters what
// gets made has to force a fresh cart rather than be silently kept from the
// cart the shopper started with.
function customizationSignature(
  customization: LineItemCustomization | null | undefined,
): string {
  if (!customization) return "";

  return [
    customization.artwork?.storageKey ?? "",
    customization.customText?.value ?? "",
    customization.orderNotes ?? "",
  ].join("~");
}

function lineSignature(input: {
  variantId: string;
  quantity: number;
  widthInches: number | null;
  heightInches: number | null;
  // Only an area-priced line carries one. Medusa prices every other line
  // itself and refreshes it, so comparing those would report a change the
  // shopper never made.
  unitPrice: number | null;
  customization: string;
}): string {
  return [
    input.variantId,
    input.quantity,
    input.widthInches ?? "",
    input.heightInches ?? "",
    input.unitPrice ?? "",
    input.customization,
  ].join(":");
}

function itemsSignature(lines: readonly string[]): string {
  return [...lines].sort().join(",");
}

type PaymentSessionWithData = {
  id: string;
  provider_id: string;
  data?: { client_secret?: string } | null;
};

type PreparedCart = {
  id: string;
  currency_code: string;
  item_subtotal: number;
  shipping_subtotal: number;
  tax_total: number;
  total: number;
  payment_collection?: {
    id: string;
    amount?: number | string | null;
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
      message: `invalid_shipping_quote:${shippingResult.reason}`,
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
      message: `invalid_tax_quote:${taxResult.reason}`,
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
    return res.status(502).json({
      error: "checkout_unavailable",
      reason: "misconfigured",
      message: "checkout_unavailable:misconfigured",
    });
  }

  // The last point before money, and the only server path a configured line
  // reaches. The artwork's facts come from the ledger inspect wrote, never the
  // request; the comparison against the product's threshold happens here.
  const validated = new Map<number, LineItemCustomization>();
  const orderLines = new Map<
    number,
    { isCustomizable: boolean; details: CheckoutLineItemDetail[] }
  >();
  let variants: VariantWithCustomization[];

  try {
    const { data } = await query.graph({
      entity: "variant",
      fields: VARIANT_CUSTOMIZATION_FIELDS,
      filters: {
        id: [...new Set(items.map((item) => item.variantId))],
      },
    });
    variants = data as VariantWithCustomization[];
  } catch (error) {
    logger.error(
      `[checkout:unavailable] reason=customization_lookup_failed error=${describeError(error)}`,
    );
    return res.status(502).json({
      error: "checkout_unavailable",
      reason: "misconfigured",
      message: "checkout_unavailable:misconfigured",
    });
  }

  const byId = new Map(variants.map((variant) => [variant.id, variant]));

  const storageKeys = [
    ...new Set(
      items.flatMap((item) =>
        item.customization?.artwork
          ? [item.customization.artwork.storageKey]
          : [],
      ),
    ),
  ];
  const ledger = new Map<string, ArtworkAssetRow>();

  if (storageKeys.length > 0) {
    try {
      const artwork = req.scope.resolve<ArtworkModuleService>(ARTWORK_MODULE);

      for (const row of await artwork.listByStagingKeys(storageKeys)) {
        ledger.set(row.staging_key, row);
      }
    } catch (error) {
      logger.error(
        `[checkout:unavailable] reason=artwork_lookup_failed error=${describeError(error)}`,
      );
      return res.status(502).json({
        error: "checkout_unavailable",
        reason: "misconfigured",
        message: "checkout_unavailable:misconfigured",
      });
    }
  }

  const now = new Date();
  const refusals: (CheckoutLineRefusal & { detail?: string })[] = [];

  for (const [index, item] of items.entries()) {
    const variant = byId.get(item.variantId);

    // A customization we cannot resolve rules for is one we cannot check, and
    // storing an unchecked one is the hole this closes.
    if (!variant) {
      refusals.push({
        error: "invalid_customization",
        reason: "unknown_variant",
        line: index,
        detail: item.variantId,
      });
      continue;
    }

    let requested = item.customization;

    if (requested?.artwork) {
      const resolved = artworkFromLedger(
        requested.artwork,
        ledger.get(requested.artwork.storageKey),
        now,
      );

      if (!resolved.ok) {
        refusals.push({
          error: "invalid_customization",
          reason: resolved.reason,
          line: index,
        });
        continue;
      }

      requested = { ...requested, artwork: resolved.artwork };
    }

    let customization: LineItemCustomization;

    try {
      customization = validateCustomization(
        requested ?? {},
        customizationRulesForVariant(variant),
      );
    } catch (error) {
      refusals.push(
        error instanceof CustomizationRejection
          ? {
              error: "invalid_customization",
              reason: error.reason,
              input: error.input,
              line: index,
            }
          : {
              error: "invalid_customization",
              reason: "rejected",
              line: index,
              detail: describeError(error),
            },
      );
      continue;
    }

    if (item.customization != null) validated.set(index, customization);

    const facts = orderLineFactsForVariant(variant);
    orderLines.set(index, {
      isCustomizable: facts.isCustomizable,
      details: lineItemDetails({
        options: facts.options,
        customization: validated.get(index),
        sizeOptionTitle: facts.sizeOptionTitle,
      }),
    });
  }

  // An area-priced line cannot be left to Medusa: the amount depends on the
  // size the line's customization records, which no price set knows about. The
  // token proves which line the shopper was quoted for; the amount is re-derived
  // here rather than read off the request, so a tampered quote buys nothing.
  const unitPrices = new Map<number, number>();
  let pricingFailed = false;

  for (const [index, item] of items.entries()) {
    const dimensions = validated.get(index)?.dimensions;
    if (dimensions == null) continue;

    if (item.priceQuoteToken == null) {
      refusals.push({
        error: "invalid_price_quote",
        reason: "missing",
        line: index,
      });
      continue;
    }

    const expected = priceSignature({
      variantId: item.variantId,
      quantity: item.quantity,
      widthInches: dimensions.widthInches,
      heightInches: dimensions.heightInches,
    });
    const quoteResult = verifyPriceQuote(
      item.priceQuoteToken,
      process.env.PRICE_QUOTE_SECRET as string,
      { priceSignature: expected },
    );

    if (!quoteResult.valid) {
      refusals.push({
        error: "invalid_price_quote",
        reason: quoteResult.reason,
        line: index,
      });
      continue;
    }

    if (pricingFailed) continue;

    let priced: Awaited<ReturnType<typeof resolveLinePrice>>;

    try {
      priced = await resolveLinePrice(pricedVariantQuery(query, region), {
        variantId: item.variantId,
        quantity: item.quantity,
        dimensions,
      });
    } catch (error) {
      logger.error(
        `[checkout:unavailable] reason=pricing_failed variant=${item.variantId} error=${describeError(error)}`,
      );
      pricingFailed = true;
      continue;
    }

    if (!priced.ok) {
      refusals.push({
        error: "invalid_price_quote",
        reason: priced.reason,
        line: index,
      });
      continue;
    }

    unitPrices.set(index, priced.price.unitAmount);
  }

  refusals.sort((a, b) => a.line - b.line);
  const [firstRefusal] = refusals;

  if (firstRefusal) {
    return res.status(400).json({
      error: firstRefusal.error,
      reason: firstRefusal.reason,
      line: firstRefusal.line,
      lines: refusals.map(({ detail: _detail, ...refusal }) => refusal),
      message: formatCheckoutLineRefusals(refusals),
    });
  }

  if (pricingFailed) {
    return res.status(502).json({
      error: "checkout_unavailable",
      reason: "pricing_failed",
      message: "checkout_unavailable:pricing_failed",
    });
  }

  const requestedItems = itemsSignature(
    items.map((item, index) =>
      lineSignature({
        variantId: item.variantId,
        quantity: item.quantity,
        widthInches: validated.get(index)?.dimensions?.widthInches ?? null,
        heightInches: validated.get(index)?.dimensions?.heightInches ?? null,
        unitPrice: unitPrices.get(index) ?? null,
        customization: customizationSignature(validated.get(index)),
      }),
    ),
  );

  let reusableCartId: string | null = null;

  if (cartId) {
    const { data: existingCarts } = await query.graph({
      entity: "cart",
      fields: ["id", "completed_at", "items.*"],
      filters: { id: cartId },
    });
    const existingCart = existingCarts[0] as CartWithItems | undefined;

    // Reuse is only for an address edit, which is what keeps the shopper's
    // PaymentIntent alive across one. updateCartWorkflow cannot change line
    // items, so a cart whose lines no longer match the request would be
    // prepared — and charged — at the configuration it was created with.
    const storedItems = existingCart
      ? itemsSignature(
          (existingCart.items ?? []).map((item) =>
            lineSignature({
              variantId: item.variant_id ?? "",
              quantity: toAmount(item.quantity),
              widthInches: item.metadata?.dimensions?.widthInches ?? null,
              heightInches: item.metadata?.dimensions?.heightInches ?? null,
              unitPrice: item.is_custom_price
                ? toAmount(item.unit_price)
                : null,
              customization: customizationSignature(
                item.metadata?.customization,
              ),
            }),
          ),
        )
      : null;

    const reason = !existingCart
      ? "not_found"
      : existingCart.completed_at
        ? "completed"
        : storedItems !== requestedItems
          ? "items_changed"
          : null;

    if (reason === null && existingCart) {
      reusableCartId = existingCart.id;
    } else {
      logger.warn(`[checkout:cart-superseded] reason=${reason} cart=${cartId}`);
    }
  }

  let cartIdToPrepare: string;

  if (reusableCartId) {
    await updateCartWorkflow(req.scope).run({
      input: {
        id: reusableCartId,
        region_id: region.id,
        email,
        shipping_address: toCartAddress(shippingAddress),
        billing_address: toCartAddress(billingAddress),
      },
    });

    cartIdToPrepare = reusableCartId;
  } else {
    const { result: createdCart } = await createCartWorkflow(req.scope).run({
      input: {
        region_id: region.id,
        email,
        shipping_address: toCartAddress(shippingAddress),
        billing_address: toCartAddress(billingAddress),
        items: items.map((item, index) => {
          const customization = validated.get(index);

          return {
            variant_id: item.variantId,
            quantity: item.quantity,
            // Set only for an area-priced line. Medusa marks such a line
            // is_custom_price and stops re-pricing it, which is wanted here and
            // wrong everywhere else — an ordinary line must keep picking up its
            // quantity break on every cart refresh.
            ...(unitPrices.has(index)
              ? { unit_price: unitPrices.get(index) }
              : {}),
            metadata: {
              ...orderLines.get(index),
              ...(customization?.dimensions
                ? { dimensions: customization.dimensions }
                : {}),
              ...(customization ? { customization } : {}),
            },
          };
        }),
      },
    });

    cartIdToPrepare = (createdCart as { id: string }).id;
  }

  await addShippingMethodToCartWorkflow(req.scope).run({
    input: {
      cart_id: cartIdToPrepare,
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

  const { data: preparedCarts } = await query.graph({
    entity: "cart",
    fields: [
      "id",
      "currency_code",
      "item_subtotal",
      "shipping_subtotal",
      "tax_total",
      "total",
      "payment_collection.id",
      "payment_collection.amount",
      "payment_collection.payment_sessions.id",
      "payment_collection.payment_sessions.provider_id",
      "payment_collection.payment_sessions.data",
    ],
    filters: { id: cartIdToPrepare },
  });
  const cart = preparedCarts[0] as PreparedCart | undefined;

  if (!cart) {
    logger.error(
      `[checkout:unavailable] reason=cart_missing cart=${cartIdToPrepare}`,
    );
    return res.status(502).json({
      error: "checkout_unavailable",
      reason: "cart_missing",
      message: "checkout_unavailable:cart_missing",
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
  const collectionMatchesTotal =
    cart.payment_collection?.amount != null &&
    Number(cart.payment_collection.amount) === Number(cart.total);

  let clientSecret = collectionMatchesTotal
    ? existingSession?.data?.client_secret
    : undefined;

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
    logger.error(
      `[checkout:unavailable] reason=no_client_secret cart=${cart.id}`,
    );
    return res.status(502).json({
      error: "checkout_unavailable",
      reason: "payment_unavailable",
      message: "checkout_unavailable:payment_unavailable",
    });
  }

  return res.json({
    cartId: cart.id,
    clientSecret,
    totals: {
      subtotal: cart.item_subtotal,
      shipping: cart.shipping_subtotal,
      tax: cart.tax_total,
      total: cart.total,
      currencyCode: cart.currency_code,
    },
  });
}
