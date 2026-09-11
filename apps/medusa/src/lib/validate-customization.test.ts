import { MedusaError } from "@medusajs/framework/utils";
import { validateCustomization } from "./validate-customization.js";

const RULES = {
  bounds: { minInches: 2, maxInches: 48 },
  textMaxLength: 120,
  minDpi: 300,
};

const lowResArtwork = {
  artwork: {
    storageKey: "artwork/a.png",
    fileName: "a.png",
    mimeType: "image/png",
    sizeBytes: 1024,
    widthPx: 600,
    heightPx: 600,
  },
  dimensions: { widthInches: 8, heightInches: 8 },
};

function captureThrown(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }

  throw new Error("Expected the call to throw, but it returned normally.");
}

describe("validateCustomization", () => {
  it("returns the parsed payload when valid", () => {
    const result = validateCustomization(
      {
        customText: { value: "For Grandma" },
        orderNotes: "Gift wrap please",
      },
      RULES,
    );

    expect(result.customText?.value).toBe("For Grandma");
    expect(result.orderNotes).toBe("Gift wrap please");
  });

  it("accepts an empty payload for a ready-made product", () => {
    expect(validateCustomization({}, RULES)).toEqual({});
  });

  it("throws when custom text is empty", () => {
    expect(() =>
      validateCustomization({ customText: { value: "" } }, RULES),
    ).toThrow(/Invalid line item customization/);
    expect(() =>
      validateCustomization({ customText: { value: "" } }, RULES),
    ).toThrow(MedusaError);
  });

  it("names the offending field in the error message", () => {
    expect(() =>
      validateCustomization({ customText: { value: "" } }, RULES),
    ).toThrow(/customText\.value/);
  });

  it("holds custom text to the product's own limit, not the schema ceiling", () => {
    const overLimit = { customText: { value: "a".repeat(121) } };

    expect(() => validateCustomization(overLimit, RULES)).toThrow(
      /customText: Shorten this to 120 characters or fewer/,
    );
    // The same payload passes for a product whose owner allows more.
    expect(
      validateCustomization(overLimit, { ...RULES, textMaxLength: 200 })
        .customText?.value,
    ).toHaveLength(121);
  });

  it("counts an emoji the way the storefront counted it", () => {
    const threeEmoji = {
      customText: { value: "\u{1F44D}\u{1F3FD}".repeat(3) },
    };

    expect(
      validateCustomization(threeEmoji, { ...RULES, textMaxLength: 3 })
        .customText?.value,
    ).toBeTruthy();
    expect(() =>
      validateCustomization(threeEmoji, { ...RULES, textMaxLength: 2 }),
    ).toThrow(/customText: Shorten this/);
  });

  // The storefront blocks add-to-cart on a line break; this is the half that
  // does not depend on the browser.
  it("refuses custom text carrying a line break", () => {
    expect(() =>
      validateCustomization(
        { customText: { value: "Happy\nBirthday" } },
        RULES,
      ),
    ).toThrow(/customText\.value/);
  });

  it("leaves order notes free to run to several lines", () => {
    expect(
      validateCustomization(
        { orderNotes: "Matte finish\nGift wrap, please" },
        RULES,
      ).orderNotes,
    ).toBe("Matte finish\nGift wrap, please");
  });

  it("throws on a non-object payload", () => {
    expect(() => validateCustomization("nope", RULES)).toThrow(
      /Invalid line item customization/,
    );
    expect(() => validateCustomization("nope", RULES)).toThrow(MedusaError);
  });

  // A plain Error carrying the same message would satisfy every assertion above
  // except these. The error type is what maps the failure to a 400 rather than
  // a 500, so it is asserted directly.
  describe("error type", () => {
    it.each([
      ["empty custom text", { customText: { value: "" } }],
      ["artwork below the resolution floor", lowResArtwork],
      ["a non-object payload", "nope"],
    ])("is INVALID_DATA for %s", (_label, payload) => {
      const thrown = captureThrown(() => validateCustomization(payload, RULES));

      expect(thrown).toBeInstanceOf(MedusaError);
      expect((thrown as MedusaError).type).toBe(MedusaError.Types.INVALID_DATA);
    });
  });

  it("rejects a dimension outside the product's own bounds", () => {
    const oversized = { dimensions: { widthInches: 60, heightInches: 10 } };

    expect(() => validateCustomization(oversized, RULES)).toThrow(
      /between 2 and 48 inches/,
    );
    expect(() => validateCustomization(oversized, RULES)).toThrow(MedusaError);
  });

  it("accepts a dimension the bounds allow", () => {
    expect(
      validateCustomization(
        { dimensions: { widthInches: 8, heightInches: 10 } },
        RULES,
      ).dimensions,
    ).toEqual({ widthInches: 8, heightInches: 10 });
  });

  describe("artwork resolution", () => {
    it("rejects artwork below the floor, naming both resolutions", () => {
      expect(() => validateCustomization(lowResArtwork, RULES)).toThrow(
        /75 DPI/,
      );
      expect(() => validateCustomization(lowResArtwork, RULES)).toThrow(
        /at least 300 DPI/,
      );
    });

    it("holds the file to the threshold it is given, not a constant", () => {
      // The floor is per-category configuration; a banner viewed at distance
      // and a 3-inch sticker do not want the same number.
      expect(
        validateCustomization(lowResArtwork, { ...RULES, minDpi: 72 }).artwork
          ?.widthPx,
      ).toBe(600);
    });

    it("measures against a preset width the caller names, not only typed dimensions", () => {
      const presetOrder = { artwork: lowResArtwork.artwork };

      expect(
        validateCustomization(presetOrder, {
          ...RULES,
          orderedSize: { widthInches: 2, heightInches: 2 },
        }).artwork?.widthPx,
      ).toBe(600);
      expect(() =>
        validateCustomization(presetOrder, {
          ...RULES,
          orderedSize: { widthInches: 8, heightInches: 8 },
        }),
      ).toThrow(/Invalid line item customization/);
    });

    it("rejects a file starved on the height even where the width clears", () => {
      const banner = {
        artwork: { ...lowResArtwork.artwork, widthPx: 2400, heightPx: 600 },
        dimensions: { widthInches: 8, heightInches: 40 },
      };

      expect(() => validateCustomization(banner, RULES)).toThrow(/15 DPI/);
    });

    it("lets a vector file through whatever the ordered size", () => {
      const vector = {
        artwork: {
          ...lowResArtwork.artwork,
          fileName: "a.svg",
          mimeType: "image/svg+xml" as const,
          widthPx: null,
          heightPx: null,
        },
        dimensions: { widthInches: 40, heightInches: 40 },
      };

      expect(validateCustomization(vector, RULES).artwork?.fileName).toBe(
        "a.svg",
      );
    });
  });
});
