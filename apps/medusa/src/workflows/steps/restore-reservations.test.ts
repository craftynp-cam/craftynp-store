import { buildReservationsToCreate } from "./restore-reservations.js";

const ORDER = {
  items: [
    {
      id: "ordli_1",
      quantity: 2,
      variant: {
        manage_inventory: true,
        inventory_items: [
          { inventory: { id: "iitem_1" }, required_quantity: 1 },
        ],
      },
    },
  ],
  fulfillments: [{ location_id: "sloc_1", canceled_at: null }],
};

describe("buildReservationsToCreate", () => {
  it("reserves each managed line item at the fulfillment's location", () => {
    expect(buildReservationsToCreate(ORDER, new Set())).toEqual([
      {
        line_item_id: "ordli_1",
        inventory_item_id: "iitem_1",
        location_id: "sloc_1",
        quantity: 2,
      },
    ]);
  });

  it("multiplies the line quantity by the inventory item's required quantity", () => {
    const order = {
      ...ORDER,
      items: [
        {
          ...ORDER.items[0]!,
          variant: {
            manage_inventory: true,
            inventory_items: [
              { inventory: { id: "iitem_1" }, required_quantity: 3 },
            ],
          },
        },
      ],
    };

    expect(buildReservationsToCreate(order, new Set())[0]?.quantity).toBe(6);
  });

  it("skips a line item that is already reserved, so a retry cannot double-reserve", () => {
    expect(buildReservationsToCreate(ORDER, new Set(["ordli_1"]))).toEqual([]);
  });

  it("skips a variant that does not manage inventory", () => {
    const order = {
      ...ORDER,
      items: [
        {
          ...ORDER.items[0]!,
          variant: { manage_inventory: false, inventory_items: [] },
        },
      ],
    };

    expect(buildReservationsToCreate(order, new Set())).toEqual([]);
  });

  it("reserves nothing when there is no live fulfillment to take a location from", () => {
    const cancelled = {
      ...ORDER,
      fulfillments: [{ location_id: "sloc_1", canceled_at: "2026-08-01" }],
    };

    expect(buildReservationsToCreate(cancelled, new Set())).toEqual([]);
    expect(
      buildReservationsToCreate({ ...ORDER, fulfillments: [] }, new Set()),
    ).toEqual([]);
  });
});
