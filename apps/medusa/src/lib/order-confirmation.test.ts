import { toOrderConfirmation } from "./order-confirmation";

const BASE_ROW = {
  id: "order_01",
  display_id: 42,
  email: "jamie@example.com",
  created_at: "2026-07-30T12:00:00.000Z",
  status: "pending",
  currency_code: "usd",
  customer_id: null,
  item_subtotal: 55.5,
  shipping_subtotal: 6,
  tax_total: 4.44,
  total: 65.94,
  items: [],
  shipping_address: null,
  shipping_methods: [],
};

describe("toOrderConfirmation", () => {
  it("maps totals, the shipping method and the placed date", () => {
    const result = toOrderConfirmation({
      ...BASE_ROW,
      shipping_methods: [{ name: "USPS Ground Advantage" }],
    });

    expect(result.totals).toEqual({
      subtotal: 55.5,
      shipping: 6,
      tax: 4.44,
      total: 65.94,
      currencyCode: "usd",
    });
    expect(result.shippingMethodName).toBe("USPS Ground Advantage");
    expect(result.placedAt).toBe("2026-07-30T12:00:00.000Z");
  });

  it("coerces every shape Medusa's BigNumber money fields arrive in", () => {
    // query.graph hands back BigNumber instances (numeric_); the same fields
    // arrive as a { value, precision } wrapper or a numeric string elsewhere.
    // Miss any one and the order reads as free.
    const result = toOrderConfirmation({
      ...BASE_ROW,
      item_subtotal: { numeric_: 15, raw_: { value: "15" } },
      shipping_subtotal: { value: "4.39", precision: 20 },
      tax_total: "1.3599998500000000000",
      total: 20.74999985,
      items: [
        {
          id: "item_1",
          title: "Medusa Shorts",
          variant_title: "L",
          thumbnail: null,
          quantity: 2,
          unit_price: { numeric_: 15, raw_: { value: "15" } },
          metadata: null,
        },
      ],
    });

    expect(result.totals).toEqual({
      subtotal: 15,
      shipping: 4.39,
      tax: 1.35999985,
      total: 20.74999985,
      currencyCode: "usd",
    });
    expect(result.lines[0]).toMatchObject({ unitPrice: 15, lineTotal: 30 });
  });

  it("derives the line total from unit price and quantity", () => {
    const result = toOrderConfirmation({
      ...BASE_ROW,
      items: [
        {
          id: "item_1",
          title: "Custom Die-Cut Stickers",
          variant_title: "3 inch",
          thumbnail: null,
          quantity: 50,
          unit_price: 0.75,
          metadata: null,
        },
      ],
    });

    expect(result.lines[0]).toMatchObject({
      quantity: 50,
      unitPrice: 0.75,
      lineTotal: 37.5,
      isCustomizable: false,
      details: [],
    });
  });

  it("reads customization off item metadata and drops malformed detail entries", () => {
    const result = toOrderConfirmation({
      ...BASE_ROW,
      items: [
        {
          id: "item_1",
          title: "Custom Die-Cut Stickers",
          variant_title: null,
          thumbnail: null,
          quantity: 1,
          unit_price: 10,
          metadata: {
            isCustomizable: true,
            details: [
              { label: "Text", value: "Hello" },
              { label: "Size" },
              "not-an-object",
            ],
          },
        },
      ],
    });

    expect(result.lines[0]).toMatchObject({
      isCustomizable: true,
      details: [{ label: "Text", value: "Hello" }],
    });
  });

  it("keeps a null phone and a missing province rather than failing the address", () => {
    const result = toOrderConfirmation({
      ...BASE_ROW,
      shipping_address: {
        first_name: "Jamie",
        last_name: "Rivera",
        phone: null,
        address_1: "123 Maple Street",
        address_2: null,
        city: "Springfield",
        province: null,
        postal_code: "62704",
        country_code: "us",
      },
    });

    expect(result.shippingAddress).toEqual({
      firstName: "Jamie",
      lastName: "Rivera",
      phone: null,
      address1: "123 Maple Street",
      address2: "",
      city: "Springfield",
      state: "",
      postalCode: "62704",
      countryCode: "us",
    });
  });

  it("marks an order with no customer as a guest order", () => {
    expect(toOrderConfirmation(BASE_ROW).isGuest).toBe(true);
    expect(
      toOrderConfirmation({ ...BASE_ROW, customer_id: "cus_1" }).isGuest,
    ).toBe(false);
  });
});
