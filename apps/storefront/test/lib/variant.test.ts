import {
  LOW_STOCK_THRESHOLD,
  findVariant,
  optionValueAvailability,
  variantAvailability,
} from "@/lib/variant";

describe("variantAvailability", () => {
  it("is out_of_stock at zero quantity", () => {
    expect(
      variantAvailability({ manage_inventory: true, inventory_quantity: 0 }),
    ).toBe("out_of_stock");
  });

  it("is low_stock at or below the threshold", () => {
    expect(
      variantAvailability({
        manage_inventory: true,
        inventory_quantity: LOW_STOCK_THRESHOLD,
      }),
    ).toBe("low_stock");
  });

  it("is in_stock above the threshold", () => {
    expect(
      variantAvailability({
        manage_inventory: true,
        inventory_quantity: LOW_STOCK_THRESHOLD + 1,
      }),
    ).toBe("in_stock");
  });

  it("is always in_stock when inventory is unmanaged", () => {
    expect(
      variantAvailability({ manage_inventory: false, inventory_quantity: 0 }),
    ).toBe("in_stock");
  });

  it("is always in_stock when backorder is allowed, regardless of quantity", () => {
    expect(
      variantAvailability({
        manage_inventory: true,
        allow_backorder: true,
        inventory_quantity: 0,
      }),
    ).toBe("in_stock");
  });

  it("treats a missing quantity as zero", () => {
    expect(variantAvailability({ manage_inventory: true })).toBe(
      "out_of_stock",
    );
  });
});

describe("findVariant", () => {
  const variants = [
    { id: "var_s_black", optionValueIds: ["val_s", "val_black"], availability: "in_stock" as const },
    { id: "var_m_black", optionValueIds: ["val_m", "val_black"], availability: "in_stock" as const },
  ];
  const optionIds = ["opt_size", "opt_color"];

  it("resolves the variant matching every selected option value", () => {
    const selected = { opt_size: "val_s", opt_color: "val_black" };
    expect(findVariant(variants, selected, optionIds)?.id).toBe("var_s_black");
  });

  it("returns undefined when an option has no selection yet", () => {
    const selected = { opt_size: "val_s" };
    expect(findVariant(variants, selected, optionIds)).toBeUndefined();
  });

  it("returns undefined when no variant matches the combination", () => {
    const selected = { opt_size: "val_xl", opt_color: "val_black" };
    expect(findVariant(variants, selected, optionIds)).toBeUndefined();
  });
});

describe("optionValueAvailability", () => {
  const options = [
    {
      id: "opt_size",
      values: [{ id: "val_s" }, { id: "val_m" }],
    },
    {
      id: "opt_color",
      values: [{ id: "val_black" }, { id: "val_white" }],
    },
  ];

  it("flags a value unavailable when it has no purchasable variant for the current selection", () => {
    const variants = [
      {
        id: "var_s_black",
        optionValueIds: ["val_s", "val_black"],
        availability: "in_stock" as const,
      },
    ];

    const result = optionValueAvailability(options, variants, {
      opt_size: "val_s",
    });

    expect(result.opt_color?.val_black).toBe(true);
    expect(result.opt_color?.val_white).toBe(false);
  });

  it("treats an out-of-stock variant as unavailable, not hidden (AC 4)", () => {
    const variants = [
      {
        id: "var_s_black",
        optionValueIds: ["val_s", "val_black"],
        availability: "out_of_stock" as const,
      },
    ];

    const result = optionValueAvailability(options, variants, {});

    expect(result.opt_size?.val_s).toBe(false);
    expect(Object.keys(result.opt_size ?? {})).toContain("val_s");
  });
});
