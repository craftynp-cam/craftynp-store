import {
  CUSTOMIZATION_INPUTS,
  CUSTOM_SIZE_FALLBACK_BOUNDS,
  READY_MADE_PRODUCT,
  DEFAULT_ARTWORK_MIN_DPI,
  activeCustomizationInputs,
  customizationMetadataPatch,
  readOptionValueWidthInches,
  requiredCustomizationInputs,
  resolveArtworkMinDpi,
  resolveProductCustomization,
  validateProductCustomization,
} from "./product-customization.js";

const CUSTOM = {
  customizable: "true",
  customization_artwork: "required",
  customization_text: "optional",
} as const;

const CUSTOM_SIZE = {
  customizable: "true",
  customization_size: "optional",
  customization_size_min_inches: "2",
  customization_size_max_inches: "48",
  customization_size_option: "Size",
  customization_size_option_value: "Custom",
} as const;

const NO_SIZE_CONFIG = {
  ...CUSTOM_SIZE_FALLBACK_BOUNDS,
  optionTitle: null,
  optionValue: null,
};

describe("resolveProductCustomization", () => {
  it("reads a declaration off product metadata", () => {
    expect(resolveProductCustomization(CUSTOM)).toEqual({
      isCustomizable: true,
      inputs: {
        artwork: "required",
        customText: "optional",
        dimensions: "off",
        orderNotes: "off",
      },
      size: NO_SIZE_CONFIG,
    });
  });

  it("accepts a real boolean for the flag, as the admin SDK sends it", () => {
    expect(
      resolveProductCustomization({ customizable: true }).isCustomizable,
    ).toBe(true);
  });

  it.each([
    ["no metadata at all", undefined],
    ["unrelated keys only", { image_url: "https://example.test/a.png" }],
    ["the flag off", { customizable: "false" }],
    ["a flag value it does not understand", { customizable: "yes" }],
  ])("reads %s as ready-made", (_label, metadata) => {
    expect(resolveProductCustomization(metadata)).toEqual(READY_MADE_PRODUCT);
  });

  it("ignores inputs left on when the flag is off", () => {
    expect(
      resolveProductCustomization({
        customizable: "false",
        customization_artwork: "required",
      }),
    ).toEqual(READY_MADE_PRODUCT);
  });

  it("reads the size bounds and the option the toggle drives", () => {
    expect(resolveProductCustomization(CUSTOM_SIZE).size).toEqual({
      minInches: 2,
      maxInches: 48,
      optionTitle: "Size",
      optionValue: "Custom",
    });
  });

  it.each([
    ["a missing bound", { customization_size_max_inches: undefined }],
    ["a bound that is not a number", { customization_size_min_inches: "wide" }],
    ["a bound at or below zero", { customization_size_min_inches: "0" }],
    ["a minimum above the maximum", { customization_size_min_inches: "60" }],
  ])("falls back to the shared bounds on %s", (_label, override) => {
    const size = resolveProductCustomization({
      ...CUSTOM_SIZE,
      ...override,
    }).size;
    expect(size.minInches).toBe(CUSTOM_SIZE_FALLBACK_BOUNDS.minInches);
    expect(size.maxInches).toBe(CUSTOM_SIZE_FALLBACK_BOUNDS.maxInches);
  });

  it("drops the custom value when no option names it", () => {
    expect(
      resolveProductCustomization({
        ...CUSTOM_SIZE,
        customization_size_option: "",
      }).size,
    ).toMatchObject({ optionTitle: null, optionValue: null });
  });

  it("drops a mode it does not understand rather than throwing", () => {
    expect(
      resolveProductCustomization({
        customizable: "true",
        customization_artwork: "mandatory",
      }).inputs.artwork,
    ).toBe("off");
  });
});

describe("customizationMetadataPatch", () => {
  it("writes every key flat, so a round trip through CSV survives", () => {
    expect(
      customizationMetadataPatch(resolveProductCustomization(CUSTOM)),
    ).toEqual({
      customizable: "true",
      customization_artwork: "required",
      customization_text: "optional",
      customization_size: "off",
      customization_notes: "off",
      customization_size_min_inches: "",
      customization_size_max_inches: "",
      customization_size_option: "",
      customization_size_option_value: "",
    });
  });

  it("writes the size configuration only while custom size is asked for", () => {
    expect(
      customizationMetadataPatch(resolveProductCustomization(CUSTOM_SIZE)),
    ).toMatchObject({
      customization_size_min_inches: "2",
      customization_size_max_inches: "48",
      customization_size_option: "Size",
      customization_size_option_value: "Custom",
    });
  });

  it("clears every input when the product is turned back to ready-made", () => {
    const patch = customizationMetadataPatch({
      isCustomizable: false,
      inputs: {
        artwork: "required",
        customText: "required",
        dimensions: "required",
        orderNotes: "required",
      },
      size: {
        minInches: 2,
        maxInches: 48,
        optionTitle: "Size",
        optionValue: "Custom",
      },
    });

    expect(patch.customizable).toBe("false");
    for (const input of CUSTOMIZATION_INPUTS) {
      expect(patch[input.metadataKey]).toBe("off");
    }
  });

  it.each([
    ["a declaration without a custom size", CUSTOM],
    ["a declaration with one", CUSTOM_SIZE],
  ])("round-trips %s through resolve", (_label, metadata) => {
    const customization = resolveProductCustomization(metadata);
    expect(
      resolveProductCustomization(customizationMetadataPatch(customization)),
    ).toEqual(customization);
  });
});

describe("activeCustomizationInputs / requiredCustomizationInputs", () => {
  it("separates what is asked for from what is insisted on", () => {
    const customization = resolveProductCustomization(CUSTOM);
    expect(activeCustomizationInputs(customization)).toEqual([
      "artwork",
      "customText",
    ]);
    expect(requiredCustomizationInputs(customization)).toEqual(["artwork"]);
  });

  it("asks for nothing on a ready-made product", () => {
    expect(activeCustomizationInputs(READY_MADE_PRODUCT)).toEqual([]);
    expect(requiredCustomizationInputs(READY_MADE_PRODUCT)).toEqual([]);
  });
});

describe("validateProductCustomization", () => {
  it("accepts a product that declares nothing", () => {
    expect(
      validateProductCustomization(undefined, { published: true }),
    ).toEqual({ ok: true });
  });

  it("accepts a complete declaration", () => {
    expect(validateProductCustomization(CUSTOM, { published: true })).toEqual({
      ok: true,
    });
  });

  it("rejects a flag that is neither true nor false", () => {
    const result = validateProductCustomization(
      { customizable: "yes" },
      { published: false },
    );
    expect(result).toEqual({
      ok: false,
      message: expect.stringContaining("customizable"),
    });
  });

  it("rejects a mode outside the three it knows", () => {
    const result = validateProductCustomization(
      { customizable: "true", customization_artwork: "mandatory" },
      { published: false },
    );
    expect(result).toEqual({
      ok: false,
      message: expect.stringContaining("customization_artwork"),
    });
  });

  it("rejects inputs left on under a ready-made flag", () => {
    const result = validateProductCustomization(
      { customizable: "false", customization_notes: "optional" },
      { published: false },
    );
    expect(result).toEqual({
      ok: false,
      message: expect.stringContaining("orderNotes"),
    });
  });

  it("rejects publishing a customizable product that asks for nothing", () => {
    expect(
      validateProductCustomization(
        { customizable: "true" },
        { published: true },
      ).ok,
    ).toBe(false);
  });

  it("accepts a complete size configuration", () => {
    expect(
      validateProductCustomization(CUSTOM_SIZE, { published: true }),
    ).toEqual({ ok: true });
  });

  it.each([
    ["a bound that is not a number", { customization_size_min_inches: "wide" }],
    ["a bound at or below zero", { customization_size_max_inches: "0" }],
    [
      "a minimum that is not below the maximum",
      {
        customization_size_min_inches: "48",
      },
    ],
  ])("rejects %s at any status", (_label, override) => {
    expect(
      validateProductCustomization(
        { ...CUSTOM_SIZE, ...override },
        { published: false },
      ).ok,
    ).toBe(false);
  });

  it("rejects a custom option value with no option to belong to", () => {
    const result = validateProductCustomization(
      { ...CUSTOM_SIZE, customization_size_option: "" },
      { published: false },
    );
    expect(result).toEqual({
      ok: false,
      message: expect.stringContaining("customization_size_option"),
    });
  });

  it("refuses to publish a custom size with no bounds", () => {
    expect(
      validateProductCustomization(
        { customizable: "true", customization_size: "optional" },
        { published: true },
      ).ok,
    ).toBe(false);
  });

  it("lets a draft declare a custom size before its bounds are set", () => {
    expect(
      validateProductCustomization(
        { customizable: "true", customization_size: "optional" },
        { published: false },
      ),
    ).toEqual({ ok: true });
  });

  it("lets a draft be customizable before its inputs are chosen", () => {
    expect(
      validateProductCustomization(
        { customizable: "true" },
        { published: false },
      ),
    ).toEqual({ ok: true });
  });
});

describe("resolveArtworkMinDpi", () => {
  it("takes the strictest category, so a looser one cannot weaken it", () => {
    expect(
      resolveArtworkMinDpi([
        { metadata: { artwork_min_dpi: "150" } },
        { metadata: { artwork_min_dpi: "300" } },
      ]),
    ).toBe(300);
  });

  it("ignores a category that declares nothing", () => {
    expect(
      resolveArtworkMinDpi([
        { metadata: { artwork_min_dpi: "300" } },
        { metadata: { image_url: "https://example.test/sale.jpg" } },
        { metadata: null },
      ]),
    ).toBe(300);
  });

  it("reads a number as readily as a string, since a CSV writes one and the widget the other", () => {
    expect(resolveArtworkMinDpi([{ metadata: { artwork_min_dpi: 240 } }])).toBe(
      240,
    );
  });

  it("rounds a fractional threshold rather than comparing against a fraction", () => {
    expect(
      resolveArtworkMinDpi([{ metadata: { artwork_min_dpi: "299.6" } }]),
    ).toBe(300);
  });

  it("ignores a value it cannot read rather than throwing on it", () => {
    // The owner can type anything into the raw metadata editor or a CSV column.
    expect(
      resolveArtworkMinDpi([
        { metadata: { artwork_min_dpi: "three hundred" } },
        { metadata: { artwork_min_dpi: "-50" } },
        { metadata: { artwork_min_dpi: "" } },
      ]),
    ).toBe(DEFAULT_ARTWORK_MIN_DPI);
  });

  it("falls back when a product is in no category at all", () => {
    expect(resolveArtworkMinDpi([])).toBe(DEFAULT_ARTWORK_MIN_DPI);
    expect(resolveArtworkMinDpi(null)).toBe(DEFAULT_ARTWORK_MIN_DPI);
  });
});

describe("readOptionValueWidthInches", () => {
  it("reads either spelling, as the sub-label read does", () => {
    expect(readOptionValueWidthInches({ width_inches: "3" })).toBe(3);
    expect(readOptionValueWidthInches({ widthInches: 2.5 })).toBe(2.5);
  });

  it("returns null for a preset that names no physical width", () => {
    expect(readOptionValueWidthInches({ subLabel: "Small" })).toBeNull();
    expect(readOptionValueWidthInches({ width_inches: "wide" })).toBeNull();
    expect(readOptionValueWidthInches(null)).toBeNull();
  });
});
