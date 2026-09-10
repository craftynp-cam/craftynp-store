import {
  CUSTOM_TEXT_LENGTH_CEILING,
  ORDER_NOTES_MAX_LENGTH,
  artworkReferenceSchema,
  checkArtworkResolution,
  checkCustomDimensions,
  customDimensionsSchema,
  customTextSchema,
  checkTextLength,
  effectiveDpi,
  lineItemCustomizationSchema,
  requiredPixels,
  textLength,
} from "./customization.js";

const validArtwork = {
  storageKey: "artwork/abc123.png",
  fileName: "monogram.png",
  mimeType: "image/png" as const,
  sizeBytes: 20_480,
  widthPx: 1200,
  heightPx: 1200,
};

describe("textLength", () => {
  it("counts what a shopper would point at, not UTF-16 code units", () => {
    // Four code units, one thing on the piece.
    expect("\u{1F44D}\u{1F3FD}".length).toBe(4);
    expect(textLength("\u{1F44D}\u{1F3FD}")).toBe(1);
  });

  it("counts a combining accent with the letter it sits on", () => {
    expect(textLength("e\u0301")).toBe(1);
  });

  it("measures the trimmed value, as the schemas store it", () => {
    expect(textLength("  hello  ")).toBe(5);
  });
});

describe("checkTextLength", () => {
  it("passes text at exactly the limit", () => {
    expect(checkTextLength("a".repeat(20), 20)).toBe(null);
  });

  it("says how far over the limit the text runs", () => {
    expect(checkTextLength("a".repeat(23), 20)).toBe(
      "Shorten this to 20 characters or fewer \u2014 3 characters over.",
    );
  });

  it("counts one character over in the singular", () => {
    expect(checkTextLength("a".repeat(21), 20)).toContain("1 character over");
  });

  it("holds an emoji to the same count the field showed", () => {
    expect(checkTextLength("\u{1F44D}\u{1F3FD}".repeat(3), 3)).toBe(null);
  });
});

describe("customTextSchema", () => {
  it("trims surrounding whitespace", () => {
    const result = customTextSchema.parse({ value: "  For Grandma  " });
    expect(result.value).toBe("For Grandma");
  });

  it("rejects text that is empty once trimmed", () => {
    expect(customTextSchema.safeParse({ value: "   " }).success).toBe(false);
  });

  // The schema stops the absolute ceiling only; the product's own limit is
  // checkTextLength's job, exactly as custom size bounds narrow a positive
  // number of inches.
  it("accepts text a product's own limit would refuse", () => {
    expect(customTextSchema.safeParse({ value: "a".repeat(200) }).success).toBe(
      true,
    );
  });

  it("accepts text at exactly the ceiling", () => {
    expect(
      customTextSchema.safeParse({
        value: "a".repeat(CUSTOM_TEXT_LENGTH_CEILING),
      }).success,
    ).toBe(true);
  });

  it("rejects text one character past the ceiling", () => {
    expect(
      customTextSchema.safeParse({
        value: "a".repeat(CUSTOM_TEXT_LENGTH_CEILING + 1),
      }).success,
    ).toBe(false);
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

describe("requiredPixels", () => {
  it("rounds up, so the count it names actually clears the floor", () => {
    expect(requiredPixels(300, 2.5)).toBe(750);
    expect(requiredPixels(300, 2.505)).toBe(752);
  });
});

describe("checkArtworkResolution", () => {
  const square = { mimeType: "image/png", widthPx: 900, heightPx: 900 };

  it("accepts a file above the floor on both axes", () => {
    expect(
      checkArtworkResolution(square, {
        minDpi: 150,
        widthInches: 3,
        heightInches: 3,
      }),
    ).toEqual({ ok: true });
  });

  it("accepts a file sitting exactly on the floor", () => {
    expect(
      checkArtworkResolution(square, {
        minDpi: 300,
        widthInches: 3,
        heightInches: 3,
      }),
    ).toEqual({ ok: true });
  });

  it("rejects a file below the floor, naming what it has and what it needs", () => {
    const result = checkArtworkResolution(square, {
      minDpi: 300,
      widthInches: 8,
      heightInches: 8,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.detectedDpi).toBe(112);
    expect(result.requiredDpi).toBe(300);
    expect(result.requiredPx).toBe(2400);
    expect(result.message).toContain("112 DPI");
    expect(result.message).toContain("300 DPI");
    expect(result.message).toContain("2,400 pixels");
  });

  it("fails on the coarsest axis, not whichever one is checked first", () => {
    // A banner ordered 8" x 40" from a 2400x600 file clears 300 DPI across and
    // prints at 15 DPI down its length. Checking the width alone calls that
    // acceptable, which is exactly the bad physical product this gate exists
    // to stop.
    const wide = { mimeType: "image/png", widthPx: 2400, heightPx: 600 };
    const result = checkArtworkResolution(wide, {
      minDpi: 300,
      widthInches: 8,
      heightInches: 40,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.axis).toBe("height");
    expect(result.detectedDpi).toBe(15);
    expect(result.message).toContain("40\u2033 tall");
    expect(result.message).toContain("12,000 pixels down");
  });

  it("re-checks against the ordered size, so growing the order can fail a file that passed", () => {
    expect(
      checkArtworkResolution(square, {
        minDpi: 300,
        widthInches: 3,
        heightInches: 3,
      }).ok,
    ).toBe(true);
    expect(
      checkArtworkResolution(square, {
        minDpi: 300,
        widthInches: 4,
        heightInches: 4,
      }).ok,
    ).toBe(false);
  });

  it.each(["image/svg+xml", "application/pdf", "application/illustrator"])(
    "lets %s through, since a vector file has no fixed resolution",
    (mimeType) => {
      expect(
        checkArtworkResolution(
          { mimeType, widthPx: 10, heightPx: 10 },
          { minDpi: 600, widthInches: 96, heightInches: 96 },
        ),
      ).toEqual({ ok: true });
    },
  );

  it("checks the one axis it knows when the other is unmeasured", () => {
    expect(
      checkArtworkResolution(square, {
        minDpi: 300,
        widthInches: null,
        heightInches: 8,
      }).ok,
    ).toBe(false);
  });

  it("cannot check an ordered size it does not know at all", () => {
    expect(
      checkArtworkResolution(square, {
        minDpi: 300,
        widthInches: null,
        heightInches: null,
      }),
    ).toEqual({ ok: true });
  });

  it("cannot check a file whose pixels were never measured", () => {
    expect(
      checkArtworkResolution(
        { mimeType: "image/png", widthPx: null, heightPx: null },
        { minDpi: 300, widthInches: 8, heightInches: 8 },
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

  it("accepts order notes at exactly the limit", () => {
    const result = lineItemCustomizationSchema.safeParse({
      orderNotes: "a".repeat(ORDER_NOTES_MAX_LENGTH),
    });
    expect(result.success).toBe(true);
  });

  it("rejects order notes past the limit", () => {
    const result = lineItemCustomizationSchema.safeParse({
      orderNotes: "a".repeat(ORDER_NOTES_MAX_LENGTH + 1),
    });
    expect(result.success).toBe(false);
  });
});
