import {
  artworkReferenceSchema,
  checkArtworkResolution,
  checkCustomDimensions,
  customDimensionsSchema,
  customTextSchema,
  effectiveDpi,
  lineItemCustomizationSchema,
  requiredPixelWidth,
} from "./customization.js";

const validArtwork = {
  storageKey: "artwork/abc123.png",
  fileName: "monogram.png",
  mimeType: "image/png" as const,
  sizeBytes: 20_480,
  widthPx: 1200,
  heightPx: 1200,
};

describe("customTextSchema", () => {
  it("trims surrounding whitespace", () => {
    const result = customTextSchema.parse({ value: "  For Grandma  " });
    expect(result.value).toBe("For Grandma");
  });

  it("rejects text that is empty once trimmed", () => {
    expect(customTextSchema.safeParse({ value: "   " }).success).toBe(false);
  });

  it("rejects text longer than 120 characters", () => {
    expect(customTextSchema.safeParse({ value: "a".repeat(121) }).success).toBe(
      false,
    );
  });

  it("accepts text at exactly 120 characters", () => {
    expect(customTextSchema.safeParse({ value: "a".repeat(120) }).success).toBe(
      true,
    );
  });
});

describe("artworkReferenceSchema", () => {
  it("accepts a well-formed reference", () => {
    expect(artworkReferenceSchema.safeParse(validArtwork).success).toBe(true);
  });

  it("accepts a vector reference, which has no pixel dimensions", () => {
    const vector = {
      ...validArtwork,
      mimeType: "image/svg+xml" as const,
      widthPx: null,
      heightPx: null,
    };
    expect(artworkReferenceSchema.safeParse(vector).success).toBe(true);
  });

  it("leaves the resolution floor to checkArtworkResolution", () => {
    // The floor is per-category configuration, so a low-resolution file is a
    // well-formed reference. Baking a minimum in here would put a second,
    // disagreeing policy behind the one the shopper was shown.
    const low = { ...validArtwork, widthPx: 100, heightPx: 100 };
    expect(artworkReferenceSchema.safeParse(low).success).toBe(true);
  });

  it("rejects an unsupported file type", () => {
    const gif = { ...validArtwork, mimeType: "image/gif" };
    expect(artworkReferenceSchema.safeParse(gif).success).toBe(false);
  });

  it("rejects a zero-byte file", () => {
    const empty = { ...validArtwork, sizeBytes: 0 };
    expect(artworkReferenceSchema.safeParse(empty).success).toBe(false);
  });
});

describe("effectiveDpi", () => {
  it("rounds down, so a file never reads as sharper than it is", () => {
    expect(effectiveDpi(899, 3)).toBe(299);
  });
});

describe("requiredPixelWidth", () => {
  it("rounds up, so the pixel count it names actually clears the floor", () => {
    expect(requiredPixelWidth(300, 2.5)).toBe(750);
    expect(requiredPixelWidth(300, 2.505)).toBe(752);
  });
});

describe("checkArtworkResolution", () => {
  const raster = { mimeType: "image/png", widthPx: 900 };

  it("accepts a file above the floor", () => {
    expect(
      checkArtworkResolution(raster, { minDpi: 150, orderedWidthInches: 3 }),
    ).toEqual({ ok: true });
  });

  it("accepts a file sitting exactly on the floor", () => {
    expect(
      checkArtworkResolution(raster, { minDpi: 300, orderedWidthInches: 3 }),
    ).toEqual({ ok: true });
  });

  it("rejects a file below the floor, naming what it has and what it needs", () => {
    const result = checkArtworkResolution(raster, {
      minDpi: 300,
      orderedWidthInches: 8,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.detectedDpi).toBe(112);
    expect(result.requiredDpi).toBe(300);
    expect(result.requiredWidthPx).toBe(2400);
    expect(result.message).toContain("112 DPI");
    expect(result.message).toContain("300 DPI");
    expect(result.message).toContain("2,400 pixels");
  });

  it("re-checks against the ordered size, so growing the order can fail a file that passed", () => {
    const context = { minDpi: 300 };
    expect(
      checkArtworkResolution(raster, { ...context, orderedWidthInches: 3 }).ok,
    ).toBe(true);
    expect(
      checkArtworkResolution(raster, { ...context, orderedWidthInches: 4 }).ok,
    ).toBe(false);
  });

  it.each(["image/svg+xml", "application/pdf", "application/illustrator"])(
    "lets %s through, since a vector file has no fixed resolution",
    (mimeType) => {
      expect(
        checkArtworkResolution(
          { mimeType, widthPx: 10 },
          { minDpi: 600, orderedWidthInches: 96 },
        ),
      ).toEqual({ ok: true });
    },
  );

  it("cannot check an ordered width it does not know", () => {
    expect(
      checkArtworkResolution(raster, { minDpi: 300, orderedWidthInches: null }),
    ).toEqual({ ok: true });
  });

  it("cannot check a file whose pixel width was never measured", () => {
    expect(
      checkArtworkResolution(
        { mimeType: "image/png", widthPx: null },
        { minDpi: 300, orderedWidthInches: 8 },
      ),
    ).toEqual({ ok: true });
  });
});

describe("customDimensionsSchema", () => {
  it("accepts positive dimensions", () => {
    const result = customDimensionsSchema.parse({
      widthInches: 12.5,
      heightInches: 18,
    });
    expect(result.widthInches).toBe(12.5);
  });

  it("rejects a non-positive dimension", () => {
    expect(
      customDimensionsSchema.safeParse({ widthInches: 0, heightInches: 10 })
        .success,
    ).toBe(false);
  });

  it("leaves the range to the product's own bounds", () => {
    expect(
      customDimensionsSchema.safeParse({ widthInches: 400, heightInches: 400 })
        .success,
    ).toBe(true);
  });
});

describe("checkCustomDimensions", () => {
  const bounds = { minInches: 2, maxInches: 48 };

  it("accepts a size inside the bounds", () => {
    expect(
      checkCustomDimensions({ widthInches: 8, heightInches: 10 }, bounds),
    ).toEqual({});
  });

  it("accepts a size sitting exactly on each bound", () => {
    expect(
      checkCustomDimensions({ widthInches: 2, heightInches: 48 }, bounds),
    ).toEqual({});
  });

  it("names the offending side and the range it must sit in", () => {
    expect(
      checkCustomDimensions({ widthInches: 1, heightInches: 10 }, bounds),
    ).toEqual({ widthInches: "Enter a width between 2 and 48 inches." });
  });

  it("reports both sides when both are out of range", () => {
    expect(
      checkCustomDimensions({ widthInches: 1, heightInches: 60 }, bounds),
    ).toEqual({
      widthInches: "Enter a width between 2 and 48 inches.",
      heightInches: "Enter a height between 2 and 48 inches.",
    });
  });
});

describe("lineItemCustomizationSchema", () => {
  it("accepts an empty payload, as a ready-made product has no customization", () => {
    expect(lineItemCustomizationSchema.safeParse({}).success).toBe(true);
  });

  it("accepts a fully populated payload", () => {
    const result = lineItemCustomizationSchema.safeParse({
      customText: { value: "For Grandma" },
      artwork: validArtwork,
      dimensions: { widthInches: 8, heightInches: 10 },
      orderNotes: "Please gift wrap",
    });
    expect(result.success).toBe(true);
  });

  it("rejects the whole payload when a nested field is invalid", () => {
    const result = lineItemCustomizationSchema.safeParse({
      customText: { value: "" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects order notes longer than 500 characters", () => {
    const result = lineItemCustomizationSchema.safeParse({
      orderNotes: "a".repeat(501),
    });
    expect(result.success).toBe(false);
  });
});
