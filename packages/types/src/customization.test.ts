import {
  MIN_ARTWORK_DPI,
  artworkReferenceSchema,
  customDimensionsSchema,
  customTextSchema,
  lineItemCustomizationSchema,
} from "./customization.js";

const validArtwork = {
  storageKey: "artwork/abc123.png",
  fileName: "monogram.png",
  mimeType: "image/png" as const,
  sizeBytes: 20_480,
  widthPx: 1200,
  heightPx: 1200,
  dpi: 300,
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

  it("rejects artwork below the minimum DPI", () => {
    const tooLow = { ...validArtwork, dpi: MIN_ARTWORK_DPI - 1 };
    expect(artworkReferenceSchema.safeParse(tooLow).success).toBe(false);
  });

  it("accepts artwork at exactly the minimum DPI", () => {
    const atFloor = { ...validArtwork, dpi: MIN_ARTWORK_DPI };
    expect(artworkReferenceSchema.safeParse(atFloor).success).toBe(true);
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

describe("customDimensionsSchema", () => {
  it("accepts positive dimensions within the maximum", () => {
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

  it("rejects dimensions above 96 inches", () => {
    expect(
      customDimensionsSchema.safeParse({ widthInches: 97, heightInches: 10 })
        .success,
    ).toBe(false);
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
