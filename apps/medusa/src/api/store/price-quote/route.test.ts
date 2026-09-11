import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { PriceQuoteRequest } from "@craftynp/types";

import { POST } from "./route";
import { priceSignature, verifyPriceQuote } from "../../../lib/price-quote";

const SECRET = "price-quote-route-secret";
const VARIANT = "variant_01";

const AREA_METADATA = {
  customizable: "true",
  customization_size: "optional",
  customization_size_min_inches: "2",
  customization_size_max_inches: "48",
  customization_size_rate_per_sq_inch: "0.055",
  customization_size_price_floor: "40",
};

type Harness = {
  req: MedusaRequest<PriceQuoteRequest>;
  res: MedusaResponse;
  json: jest.Mock;
  status: jest.Mock;
  contexts: Record<string, unknown>[];
};

function buildHarness(options: {
  body: PriceQuoteRequest;
  // Amount per ordered quantity, so a test can stand in for a price list.
  amountFor?: (quantity: number) => number | null;
  metadata?: Record<string, unknown> | null;
  noRegion?: boolean;
}): Harness {
  const contexts: Record<string, unknown>[] = [];
  const amountFor = options.amountFor ?? (() => 70);

  const graph = jest.fn(
    async ({ entity, context }: { entity: string; context?: never }) => {
      if (entity === "region") {
        return {
          data: options.noRegion
            ? []
            : [{ id: "reg_01", currency_code: "usd" }],
        };
      }

      const calculated = context as unknown as {
        calculated_price?: { context?: Record<string, unknown> };
      };
      const pricing =
        calculated?.calculated_price?.context ??
        (calculated?.calculated_price as unknown as Record<string, unknown>);
      contexts.push(pricing ?? {});

      const quantity = Number(
        (pricing as { quantity?: number } | undefined)?.quantity ?? 1,
      );
      const amount = amountFor(quantity);

      return {
        data: [
          {
            id: VARIANT,
            product: {
              metadata:
                options.metadata === undefined
                  ? AREA_METADATA
                  : options.metadata,
            },
            calculated_price:
              amount === null
                ? null
                : {
                    calculated_amount: amount,
                    original_amount: amount,
                    currency_code: "usd",
                  },
          },
        ],
      };
    },
  );

  const json = jest.fn();
  const status = jest.fn(() => ({ json }));

  return {
    req: {
      validatedBody: options.body,
      scope: {
        resolve: (key: string) =>
          key === ContainerRegistrationKeys.QUERY
            ? { graph }
            : { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
      },
    } as unknown as MedusaRequest<PriceQuoteRequest>,
    res: { json, status } as unknown as MedusaResponse,
    json,
    status,
    contexts,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.PRICE_QUOTE_SECRET = SECRET;
});

describe("POST /store/price-quote", () => {
  it("puts the ordered quantity in the pricing context, which is what makes a tier apply", async () => {
    const { req, res, contexts } = buildHarness({
      body: { variantId: VARIANT, quantity: 50 },
    });

    await POST(req, res);

    expect(contexts[0]).toMatchObject({
      region_id: "reg_01",
      currency_code: "usd",
      quantity: 50,
    });
  });

  it("quotes an ordinary line at the variant's calculated price", async () => {
    const { req, res, json } = buildHarness({
      body: { variantId: VARIANT, quantity: 3 },
      amountFor: () => 12,
    });

    await POST(req, res);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        unitAmount: 12,
        lineTotal: 36,
        isAreaPriced: false,
        currencyCode: "usd",
      }),
    );
  });

  it("prices a custom size from the product's own rate", async () => {
    const { req, res, json } = buildHarness({
      body: {
        variantId: VARIANT,
        quantity: 1,
        dimensions: { widthInches: 8, heightInches: 10 },
      },
      amountFor: () => 70,
    });

    await POST(req, res);

    // 70 * 0.055 * 80
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ unitAmount: 308, isAreaPriced: true }),
    );
  });

  it("issues a token bound to the line it quoted", async () => {
    const body: PriceQuoteRequest = {
      variantId: VARIANT,
      quantity: 10,
      dimensions: { widthInches: 8, heightInches: 10 },
    };
    const { req, res, json } = buildHarness({ body, amountFor: () => 70 });

    await POST(req, res);

    const { quoteToken } = json.mock.calls[0]?.[0] as { quoteToken: string };

    expect(
      verifyPriceQuote(quoteToken, SECRET, {
        priceSignature: priceSignature({
          variantId: VARIANT,
          quantity: 10,
          widthInches: 8,
          heightInches: 10,
        }),
      }),
    ).toMatchObject({ valid: true });

    expect(
      verifyPriceQuote(quoteToken, SECRET, {
        priceSignature: priceSignature({ variantId: VARIANT, quantity: 11 }),
      }),
    ).toMatchObject({ valid: false, reason: "line_mismatch" });
  });

  it("refuses dimensions outside the product's own bounds", async () => {
    const { req, res, status, json } = buildHarness({
      body: {
        variantId: VARIANT,
        quantity: 1,
        dimensions: { widthInches: 8, heightInches: 500 },
      },
    });

    await POST(req, res);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "invalid_line",
        reason: "bad_dimensions",
      }),
    );
  });

  it("refuses to price a custom size the owner has configured no rate for", async () => {
    const { req, res, status, json } = buildHarness({
      body: {
        variantId: VARIANT,
        quantity: 1,
        dimensions: { widthInches: 8, heightInches: 10 },
      },
      metadata: { ...AREA_METADATA, customization_size_rate_per_sq_inch: "" },
    });

    await POST(req, res);

    expect(status).toHaveBeenCalledWith(502);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "price_unavailable",
        reason: "unconfigured",
      }),
    );
  });

  it("reports a misconfigured store rather than pricing without a region", async () => {
    const { req, res, status } = buildHarness({
      body: { variantId: VARIANT, quantity: 1 },
      noRegion: true,
    });

    await POST(req, res);

    expect(status).toHaveBeenCalledWith(502);
  });

  it("carries a message alongside every error, which the SDK is the only field that survives", async () => {
    const { req, res, json } = buildHarness({
      body: { variantId: VARIANT, quantity: 1 },
      amountFor: () => null,
    });

    await POST(req, res);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.any(String) }),
    );
  });
});
