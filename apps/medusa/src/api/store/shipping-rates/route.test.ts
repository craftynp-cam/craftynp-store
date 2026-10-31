import {
  cartSignature,
  verifyShippingQuote,
} from "../../../lib/shipping-quote";
import { POST } from "./route";

const SECRET = "test-shipping-secret";

const destination = {
  countryCode: "us",
  postalCode: "78756",
  city: "Austin",
  state: "TX",
};
const items = [{ variantId: "variant_1", quantity: 2 }];

function run(storedFlatRate: string | null, knownVariantIds = ["variant_1"]) {
  const graph = jest.fn(async () => ({
    data: knownVariantIds.map((id) => ({ id })),
  }));
  const listSiteContentEntries = jest.fn(async () =>
    storedFlatRate == null
      ? []
      : [{ key: "shipping_flat_rate", value: storedFlatRate }],
  );
  const req = {
    validatedBody: { destination, items },
    scope: {
      resolve: (key: string) =>
        key === "siteContent" ? { listSiteContentEntries } : { graph },
    },
  } as never;
  const json = jest.fn();
  const res = { json, status: jest.fn(() => ({ json })) };

  return POST(req, res as never).then(() => ({ json, res }));
}

describe("POST /store/shipping-rates", () => {
  const originalSecret = process.env.SHIPPING_QUOTE_SECRET;

  beforeEach(() => {
    process.env.SHIPPING_QUOTE_SECRET = SECRET;
  });

  afterAll(() => {
    process.env.SHIPPING_QUOTE_SECRET = originalSecret;
  });

  it("offers the owner's flat rate, signed for this cart and address", async () => {
    const { json } = await run("12.50");

    const [{ rates }] = json.mock.calls[0] as [
      { rates: { amount: number; serviceCode: string; quoteToken: string }[] },
    ];
    expect(rates).toHaveLength(1);
    expect(rates[0]).toMatchObject({ amount: 12.5, serviceCode: "flat_rate" });

    const verified = verifyShippingQuote(rates[0]!.quoteToken, SECRET, {
      cartSignature: cartSignature({
        items,
        postalCode: destination.postalCode,
        countryCode: destination.countryCode,
      }),
    });
    expect(verified).toMatchObject({ valid: true, payload: { amt: 12.5 } });
  });

  it("charges the default rate when the owner has never set one", async () => {
    const { json } = await run(null);

    const [{ rates }] = json.mock.calls[0] as [{ rates: { amount: number }[] }];
    expect(rates[0]?.amount).toBe(10);
  });

  it("refuses a variant that does not exist", async () => {
    const { res, json } = await run("10.00", []);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      error: "unknown_variant",
      variantIds: ["variant_1"],
    });
  });
});
