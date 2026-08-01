import {
  buildQueueEntries,
  deriveParcel,
  toShipStationAddress,
  type OrderItemRow,
  type OrderRow,
  type VariantDimensions,
} from "./fulfilment-queue.js";

const address = {
  first_name: "Ada",
  last_name: "Lovelace",
  phone: "4085550147",
  address_1: "500 Almaden Blvd",
  address_2: "Apt 4",
  city: "San Jose",
  province: "CA",
  postal_code: "95128",
  country_code: "us",
};

function variant(
  overrides: Partial<VariantDimensions> = {},
): VariantDimensions {
  return {
    id: "variant_1",
    weight: 100,
    length: 10,
    width: 10,
    height: 10,
    product: { title: "Hand-poured candle" },
    ...overrides,
  };
}

function item(overrides: Partial<OrderItemRow> = {}): OrderItemRow {
  return {
    id: "item_1",
    title: "Hand-poured candle",
    variant_title: "Large",
    variant_sku: "CANDLE-L",
    variant_id: "variant_1",
    quantity: 1,
    ...overrides,
  };
}

describe("toShipStationAddress", () => {
  it("joins the name and carries the optional lines through", () => {
    const result = toShipStationAddress(address);
    expect(result?.name).toBe("Ada Lovelace");
    expect(result?.addressLine2).toBe("Apt 4");
  });

  it("returns null when a line the carrier needs is missing", () => {
    expect(toShipStationAddress({ ...address, address_1: null })).toBeNull();
    expect(toShipStationAddress({ ...address, postal_code: "" })).toBeNull();
    expect(
      toShipStationAddress({ ...address, first_name: null, last_name: null }),
    ).toBeNull();
  });

  it("returns null for no address at all", () => {
    expect(toShipStationAddress(null)).toBeNull();
  });

  it("keeps an absent phone absent rather than sending an empty one", () => {
    expect(toShipStationAddress({ ...address, phone: null })?.phone).toBe("");
  });
});

describe("deriveParcel", () => {
  const variants = new Map([["variant_1", variant()]]);

  it("multiplies weight by quantity across the order", () => {
    const { parcel } = deriveParcel([item({ quantity: 3 })], variants);
    expect(parcel?.weight).toBe(300);
  });

  it("falls back to the product's dimensions when the variant has none", () => {
    const withProductDims = new Map([
      [
        "variant_1",
        variant({
          weight: null,
          length: null,
          width: null,
          height: null,
          product: {
            title: "Hand-poured candle",
            weight: 250,
            length: 8,
            width: 8,
            height: 12,
          },
        }),
      ],
    ]);

    const { parcel } = deriveParcel([item()], withProductDims);
    expect(parcel).toEqual({ weight: 250, length: 8, width: 8, height: 12 });
  });

  it("names the products that are missing dimensions, never the variant ids", () => {
    const missingDims = new Map([
      [
        "variant_1",
        variant({ weight: null, product: { title: "Hand-poured candle" } }),
      ],
    ]);

    const { parcel, missing } = deriveParcel([item()], missingDims);
    expect(parcel).toBeNull();
    expect(missing).toEqual(["Hand-poured candle"]);
  });

  it("reports each missing product once, however many lines it has", () => {
    const missingDims = new Map([
      ["variant_1", variant({ weight: null })],
      ["variant_2", variant({ id: "variant_2", weight: null })],
    ]);

    const { missing } = deriveParcel(
      [
        item({ id: "item_1", variant_id: "variant_1" }),
        item({ id: "item_2", variant_id: "variant_2" }),
      ],
      missingDims,
    );

    expect(missing).toEqual(["Hand-poured candle"]);
  });

  it("treats a line with no variant as missing dimensions", () => {
    const { parcel } = deriveParcel(
      [item({ variant_id: null, title: "Custom order" })],
      variants,
    );
    expect(parcel).toBeNull();
  });
});

describe("buildQueueEntries", () => {
  const variants = new Map([["variant_1", variant()]]);

  const order: OrderRow = {
    id: "order_1",
    display_id: 1042,
    created_at: new Date("2026-08-01T10:00:00.000Z"),
    email: "ada@example.com",
    items: [item({ quantity: 2 })],
    shipping_address: address,
  };

  it("returns entries in the order the queue asked for, not the order the graph returned", () => {
    const entries = buildQueueEntries(
      ["order_2", "order_1"],
      [order, { ...order, id: "order_2", display_id: 1043 }],
      variants,
    );

    expect(entries.map((entry) => entry.displayId)).toEqual([1043, 1042]);
  });

  it("skips an id the order query did not return", () => {
    const entries = buildQueueEntries(["order_1", "gone"], [order], variants);
    expect(entries).toHaveLength(1);
  });

  it("carries the destination and the derived parcel for packing", () => {
    const [entry] = buildQueueEntries(["order_1"], [order], variants);

    expect(entry?.destination?.city).toBe("San Jose");
    expect(entry?.derivedParcel?.weight).toBe(200);
    expect(entry?.items).toEqual([
      {
        title: "Hand-poured candle",
        variantTitle: "Large",
        sku: "CANDLE-L",
        quantity: 2,
      },
    ]);
  });

  it("falls back to the email when there is no address to name the customer", () => {
    const [entry] = buildQueueEntries(
      ["order_1"],
      [{ ...order, shipping_address: null }],
      variants,
    );

    expect(entry?.customerName).toBe("ada@example.com");
    expect(entry?.destination).toBeNull();
  });
});
