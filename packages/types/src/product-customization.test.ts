import {
  CUSTOMIZATION_INPUTS,
  READY_MADE_PRODUCT,
  activeCustomizationInputs,
  customizationMetadataPatch,
  requiredCustomizationInputs,
  resolveProductCustomization,
  validateProductCustomization,
} from "./product-customization.js";

const CUSTOM = {
  customizable: "true",
  customization_artwork: "required",
  customization_text: "optional",
} as const;

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
    });

    expect(patch.customizable).toBe("false");
    for (const input of CUSTOMIZATION_INPUTS) {
      expect(patch[input.metadataKey]).toBe("off");
    }
  });

  it("round-trips through resolve", () => {
    const customization = resolveProductCustomization(CUSTOM);
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

  it("lets a draft be customizable before its inputs are chosen", () => {
    expect(
      validateProductCustomization(
        { customizable: "true" },
        { published: false },
      ),
    ).toEqual({ ok: true });
  });
});
