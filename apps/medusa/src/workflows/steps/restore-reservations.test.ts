import { buildReservationsToCreate } from "./restore-reservations.js";

const ORDER = {
  items: [
    {
      id: "ordli_1",
      quantity: 2,
      variant: {
        manage_inventory: true,
        inventory_items: [
          {
            inventory: {
              id: "iitem_1",
              location_levels: [{ location_id: "sloc_1" }],
            },
            required_quantity: 1,
          },
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
              {
                inventory: {
                  id: "iitem_1",
                  location_levels: [{ location_id: "sloc_1" }],
                },
                required_quantity: 3,
              },
            ],
          },
        },
      ],
    };

    expect(buildReservationsToCreate(order, new Set())[0]?.quantity).toBe(6);
  });

  it("reads a BigNumber quantity, which is how the graph returns it", () => {
    const bigNumber = {
      ...ORDER,
      items: [{ ...ORDER.items[0]!, quantity: { value: "2", precision: 20 } }],
    };

    expect(buildReservationsToCreate(bigNumber, new Set())[0]?.quantity).toBe(
      2,
    );
  });

  it("skips a line item whose quantity cannot be read rather than reserving NaN", () => {
    const unreadable = {
      ...ORDER,
      items: [{ ...ORDER.items[0]!, quantity: {} }],
    };

    expect(buildReservationsToCreate(unreadable, new Set())).toEqual([]);
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

  it("reserves where the item is stocked, not where the fulfillment says", () => {
    const elsewhere = {
      ...ORDER,
      fulfillments: [{ location_id: "sloc_us", canceled_at: null }],
    };

    expect(
      buildReservationsToCreate(elsewhere, new Set())[0]?.location_id,
    ).toBe("sloc_1");
  });

  it("prefers the fulfillment's location when the item is stocked there too", () => {
    const both = {
      ...ORDER,
      items: [
        {
          ...ORDER.items[0]!,
          variant: {
            manage_inventory: true,
            inventory_items: [
              {
                inventory: {
                  id: "iitem_1",
                  location_levels: [
                    { location_id: "sloc_1" },
                    { location_id: "sloc_us" },
                  ],
                },
                required_quantity: 1,
              },
            ],
          },
        },
      ],
      fulfillments: [{ location_id: "sloc_us", canceled_at: null }],
    };

    expect(buildReservationsToCreate(both, new Set())[0]?.location_id).toBe(
      "sloc_us",
    );
  });

  it("skips an inventory item stocked nowhere rather than reserving into thin air", () => {
    const nowhere = {
      ...ORDER,
      items: [
        {
          ...ORDER.items[0]!,
          variant: {
            manage_inventory: true,
            inventory_items: [
              {
                inventory: { id: "iitem_1", location_levels: [] },
                required_quantity: 1,
              },
            ],
          },
        },
      ],
    };

    expect(buildReservationsToCreate(nowhere, new Set())).toEqual([]);
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
