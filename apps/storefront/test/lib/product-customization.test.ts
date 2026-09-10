import {
  CUSTOM_TEXT_MAX_LENGTH,
  resolveProductCustomization,
} from "@craftynp/types";

import {
  EMPTY_CUSTOMIZATION_DRAFT,
  artworkGuidance,
  artworkResolutionError,
  customSizeErrors,
  customTextError,
  customTextHint,
  customizationDetails,
  missingInputLabels,
  missingRequiredInputs,
  orderedSizeInches,
  resolveCustomSizeOption,
  type CustomizationDraft,
} from "@/lib/product-customization";

const ARTWORK = {
  uploadId: "up_1",
  storageKey: "staging/up_1",
  fileName: "flowers.png",
  mimeType: "image/png" as const,
  sizeBytes: 2048,
  kind: "raster" as const,
  widthPx: 1200,
  heightPx: 1200,
};

function draft(
  overrides: Partial<CustomizationDraft> = {},
): CustomizationDraft {
  return { ...EMPTY_CUSTOMIZATION_DRAFT, ...overrides };
}

const ALL_REQUIRED = resolveProductCustomization({
  customizable: "true",
  customization_artwork: "required",
  customization_text: "required",
  customization_size: "required",
  customization_notes: "required",
  customization_size_min_inches: "2",
  customization_size_max_inches: "48",
});

const OPTIONAL_SIZE = resolveProductCustomization({
  customizable: "true",
  customization_size: "optional",
  customization_size_min_inches: "2",
  customization_size_max_inches: "48",
  customization_size_option: "Size",
  customization_size_option_value: "Custom",
});

describe("missingRequiredInputs", () => {
  it("asks for nothing on a ready-made product", () => {
    expect(
      missingRequiredInputs(resolveProductCustomization(null), draft()),
    ).toEqual([]);
  });

  it("ignores an input the product only offers as optional", () => {
    const optional = resolveProductCustomization({
      customizable: "true",
      customization_artwork: "optional",
    });

    expect(missingRequiredInputs(optional, draft())).toEqual([]);
  });

  it("lists every required input still empty", () => {
    expect(missingRequiredInputs(ALL_REQUIRED, draft())).toEqual([
      "artwork",
      "customText",
      "dimensions",
      "orderNotes",
    ]);
  });

  it("clears once each required input is satisfied", () => {
    expect(
      missingRequiredInputs(
        ALL_REQUIRED,
        draft({
          artwork: ARTWORK,
          customText: "Ellie",
          widthInches: "8",
          heightInches: "10",
          orderNotes: "Matte finish please",
        }),
      ),
    ).toEqual([]);
  });

  it("treats whitespace as empty", () => {
    expect(
      missingRequiredInputs(ALL_REQUIRED, draft({ customText: "   " })),
    ).toContain("customText");
  });

  it.each([
    ["only one side given", { widthInches: "8" }],
    ["zero", { widthInches: "0", heightInches: "10" }],
    ["not a number", { widthInches: "wide", heightInches: "10" }],
  ])("rejects a size that is %s", (_label, size) => {
    expect(missingRequiredInputs(ALL_REQUIRED, draft(size))).toContain(
      "dimensions",
    );
  });
});

describe("missingInputLabels", () => {
  it("names each missing input in shopper words", () => {
    expect(missingInputLabels(["artwork", "dimensions"])).toEqual([
      "your artwork",
      "a width and height",
    ]);
  });
});

describe("customizationDetails", () => {
  it("carries the text, size and notes the shopper filled in", () => {
    expect(
      customizationDetails(
        ALL_REQUIRED,
        draft({
          artwork: ARTWORK,
          customText: "  Ellie  ",
          widthInches: "8",
          heightInches: "10",
          orderNotes: "  Matte finish  ",
        }),
      ),
    ).toEqual([
      { label: "Custom text", value: "Ellie" },
      { label: "Size", value: "8\u2033 \u00d7 10\u2033" },
      { label: "Order notes", value: "Matte finish" },
    ]);
  });

  it("leaves artwork out — the cart cannot carry the file until CNP-45", () => {
    const details = customizationDetails(
      ALL_REQUIRED,
      draft({ artwork: ARTWORK }),
    );

    expect(details).toEqual([]);
  });

  it("skips an input the shopper left empty", () => {
    expect(
      customizationDetails(ALL_REQUIRED, draft({ customText: "Ellie" })),
    ).toEqual([{ label: "Custom text", value: "Ellie" }]);
  });

  it("skips an input the product never declared", () => {
    const notesOnly = resolveProductCustomization({
      customizable: "true",
      customization_notes: "optional",
    });

    expect(
      customizationDetails(
        notesOnly,
        draft({ customText: "Ellie", orderNotes: "Matte finish" }),
      ),
    ).toEqual([{ label: "Order notes", value: "Matte finish" }]);
  });

  it("carries nothing for a ready-made product", () => {
    expect(
      customizationDetails(
        resolveProductCustomization(null),
        draft({ customText: "Ellie" }),
      ),
    ).toEqual([]);
  });
});

const AT_LIMIT = "a".repeat(CUSTOM_TEXT_MAX_LENGTH);

describe("customTextError", () => {
  it("accepts text at exactly the limit", () => {
    expect(customTextError(ALL_REQUIRED, draft({ customText: AT_LIMIT }))).toBe(
      null,
    );
  });

  it("measures the trimmed value, as the schema does", () => {
    expect(
      customTextError(ALL_REQUIRED, draft({ customText: `  ${AT_LIMIT}  ` })),
    ).toBe(null);
  });

  it("says how far over the limit the text runs", () => {
    expect(
      customTextError(ALL_REQUIRED, draft({ customText: `${AT_LIMIT}abc` })),
    ).toBe(
      `Shorten this to ${CUSTOM_TEXT_MAX_LENGTH} characters or fewer \u2014 3 characters over.`,
    );
  });

  it("counts one character over in the singular", () => {
    expect(
      customTextError(ALL_REQUIRED, draft({ customText: `${AT_LIMIT}a` })),
    ).toContain("1 character over");
  });

  it("stays quiet on a product that never asks for text", () => {
    const notesOnly = resolveProductCustomization({
      customizable: "true",
      customization_notes: "optional",
    });

    expect(
      customTextError(notesOnly, draft({ customText: `${AT_LIMIT}a` })),
    ).toBe(null);
  });
});

describe("customTextHint", () => {
  it("states the limit before the shopper has typed anything", () => {
    expect(customTextHint("required", "")).toBe(
      `Up to ${CUSTOM_TEXT_MAX_LENGTH} characters.`,
    );
  });

  it("counts what is used once there is text", () => {
    expect(customTextHint("required", "Ellie")).toBe(
      `5 of ${CUSTOM_TEXT_MAX_LENGTH} characters used.`,
    );
  });

  it("keeps counting past the limit rather than stopping at it", () => {
    expect(customTextHint("required", `${AT_LIMIT}ab`)).toBe(
      `${CUSTOM_TEXT_MAX_LENGTH + 2} of ${CUSTOM_TEXT_MAX_LENGTH} characters used.`,
    );
  });

  it("marks an optional input as optional", () => {
    expect(customTextHint("optional", "")).toBe(
      `Optional. Up to ${CUSTOM_TEXT_MAX_LENGTH} characters.`,
    );
  });
});

describe("customSizeErrors", () => {
  it("stays quiet while the shopper is on the preset sizes", () => {
    expect(
      customSizeErrors(OPTIONAL_SIZE, draft({ widthInches: "500" })),
    ).toEqual({});
  });

  it("stays quiet on a field the shopper has not filled in yet", () => {
    expect(
      customSizeErrors(
        OPTIONAL_SIZE,
        draft({ useCustomSize: true, widthInches: "8" }),
      ),
    ).toEqual({});
  });

  it("names the range on a side outside the product's bounds", () => {
    expect(
      customSizeErrors(
        OPTIONAL_SIZE,
        draft({ useCustomSize: true, widthInches: "60", heightInches: "10" }),
      ),
    ).toEqual({ widthInches: "Enter a width between 2 and 48 inches." });
  });

  it("asks for a number when the side is not one", () => {
    expect(
      customSizeErrors(
        OPTIONAL_SIZE,
        draft({ useCustomSize: true, widthInches: "wide", heightInches: "10" }),
      ).widthInches,
    ).toMatch(/number|inches/i);
  });

  it("accepts a size inside the bounds", () => {
    expect(
      customSizeErrors(
        OPTIONAL_SIZE,
        draft({ useCustomSize: true, widthInches: "8", heightInches: "10" }),
      ),
    ).toEqual({});
  });
});

describe("the custom size toggle", () => {
  it("holds back the size until the shopper asks to enter their own", () => {
    const filled = draft({ widthInches: "8", heightInches: "10" });

    expect(customizationDetails(OPTIONAL_SIZE, filled)).toEqual([]);
    expect(
      customizationDetails(OPTIONAL_SIZE, { ...filled, useCustomSize: true }),
    ).toEqual([{ label: "Size", value: "8\u2033 \u00d7 10\u2033" }]);
  });

  it("insists on the dimensions once the shopper opts in, though the product calls the size optional", () => {
    expect(missingRequiredInputs(OPTIONAL_SIZE, draft())).toEqual([]);
    expect(
      missingRequiredInputs(OPTIONAL_SIZE, draft({ useCustomSize: true })),
    ).toEqual(["dimensions"]);
    expect(
      missingRequiredInputs(
        OPTIONAL_SIZE,
        draft({ useCustomSize: true, widthInches: "8" }),
      ),
    ).toEqual(["dimensions"]);
    expect(
      missingRequiredInputs(
        OPTIONAL_SIZE,
        draft({ useCustomSize: true, widthInches: "8", heightInches: "10" }),
      ),
    ).toEqual([]);
  });

  it("blocks a required size that is out of range", () => {
    expect(
      missingRequiredInputs(
        ALL_REQUIRED,
        draft({ widthInches: "60", heightInches: "10" }),
      ),
    ).toContain("dimensions");
  });
});

describe("resolveCustomSizeOption", () => {
  const options = [
    {
      id: "opt_size",
      title: "Size",
      values: [
        { id: "val_small", value: "Small" },
        { id: "val_custom", value: "Custom" },
      ],
    },
  ];

  it("finds the option group and value the metadata names", () => {
    expect(resolveCustomSizeOption(options, OPTIONAL_SIZE)).toEqual({
      option: options[0],
      customValue: { id: "val_custom", value: "Custom" },
    });
  });

  it("finds nothing when the product has no such value", () => {
    const presetsOnly = [{ ...options[0]!, values: [options[0]!.values[0]!] }];
    expect(resolveCustomSizeOption(presetsOnly, OPTIONAL_SIZE)).toBeNull();
  });

  it("finds nothing when the metadata names no option", () => {
    expect(resolveCustomSizeOption(options, ALL_REQUIRED)).toBeNull();
  });
});

const SIZE_OPTION = {
  id: "opt_size",
  title: "Size",
  values: [
    { id: "val_small", value: "Small", widthInches: 3, heightInches: 3 },
    { id: "val_large", value: "Large", widthInches: 12, heightInches: 12 },
    { id: "val_banner", value: "Banner", widthInches: 8, heightInches: 40 },
    { id: "val_mystery", value: "Mystery" },
    { id: "val_custom", value: "Custom" },
  ],
};

const MATERIAL_OPTION = {
  id: "opt_material",
  title: "Material",
  values: [{ id: "val_vinyl", value: "Vinyl" }],
};

const NO_SIZE = { widthInches: null, heightInches: null };

describe("orderedSizeInches", () => {
  it("reads a preset's measurements off the option value's own metadata", () => {
    expect(
      orderedSizeInches(OPTIONAL_SIZE, draft(), [SIZE_OPTION], {
        opt_size: "val_banner",
      }),
    ).toEqual({ widthInches: 8, heightInches: 40 });
  });

  it("is not told which group is the size, so any group may name it", () => {
    // VariantSelector deliberately knows nothing about sizes, and this keeps
    // the same promise: whatever value declares measurements answers.
    expect(
      orderedSizeInches(
        OPTIONAL_SIZE,
        draft(),
        [MATERIAL_OPTION, SIZE_OPTION],
        { opt_material: "val_vinyl", opt_size: "val_small" },
      ),
    ).toEqual({ widthInches: 3, heightInches: 3 });
  });

  it("prefers what the shopper typed once the custom size is on", () => {
    expect(
      orderedSizeInches(
        OPTIONAL_SIZE,
        draft({ useCustomSize: true, widthInches: "18", heightInches: "24" }),
        [SIZE_OPTION],
        { opt_size: "val_custom" },
      ),
    ).toEqual({ widthInches: 18, heightInches: 24 });
  });

  it("knows nothing for a preset the owner has not measured", () => {
    expect(
      orderedSizeInches(OPTIONAL_SIZE, draft(), [SIZE_OPTION], {
        opt_size: "val_mystery",
      }),
    ).toEqual(NO_SIZE);
  });

  it("knows only the half a custom size has been typed so far", () => {
    expect(
      orderedSizeInches(
        OPTIONAL_SIZE,
        draft({ useCustomSize: true, widthInches: "9", heightInches: "" }),
        [SIZE_OPTION],
        {},
      ),
    ).toEqual({ widthInches: 9, heightInches: null });
  });
});

describe("artworkResolutionError", () => {
  const square = { widthInches: 3, heightInches: 3 };

  it("passes a file with pixels to spare", () => {
    expect(
      artworkResolutionError(draft({ artwork: ARTWORK }), 300, square),
    ).toBeNull();
  });

  it("rejects a file too coarse for the size ordered, naming both numbers", () => {
    const message = artworkResolutionError(draft({ artwork: ARTWORK }), 300, {
      widthInches: 8,
      heightInches: 8,
    });

    expect(message).toContain("150 DPI");
    expect(message).toContain("at least 300 DPI");
  });

  it("catches a file starved on the height alone", () => {
    // A banner ordered 8" x 40" from a 2400x600 file clears 300 DPI across and
    // prints at 15 DPI down its length.
    const wide = { ...ARTWORK, widthPx: 2400, heightPx: 600 };

    expect(
      artworkResolutionError(draft({ artwork: wide }), 300, {
        widthInches: 8,
        heightInches: 40,
      }),
    ).toContain("15 DPI");
  });

  it("re-decides when the ordered size changes, which is the whole point", () => {
    const withArtwork = draft({ artwork: ARTWORK });

    expect(
      artworkResolutionError(withArtwork, 300, {
        widthInches: 4,
        heightInches: 4,
      }),
    ).toBeNull();
    expect(
      artworkResolutionError(withArtwork, 300, {
        widthInches: 5,
        heightInches: 5,
      }),
    ).not.toBeNull();
  });

  it("rejects a coarse file even where artwork is only optional", () => {
    // `optional` says the shopper need not supply artwork, not that a file too
    // coarse to print is acceptable once they have.
    expect(
      artworkResolutionError(
        draft({ artwork: { ...ARTWORK, widthPx: 200, heightPx: 200 } }),
        300,
        { widthInches: 8, heightInches: 8 },
      ),
    ).not.toBeNull();
  });

  it("lets a vector file through, whatever the ordered size", () => {
    const vector = {
      ...ARTWORK,
      fileName: "flowers.svg",
      mimeType: "image/svg+xml" as const,
      kind: "vector" as const,
      widthPx: null,
      heightPx: null,
    };

    expect(
      artworkResolutionError(draft({ artwork: vector }), 600, {
        widthInches: 96,
        heightInches: 96,
      }),
    ).toBeNull();
  });

  it("says nothing when there is no artwork to judge", () => {
    expect(artworkResolutionError(draft(), 300, square)).toBeNull();
  });

  it("says nothing when the ordered size is unknown", () => {
    expect(
      artworkResolutionError(draft({ artwork: ARTWORK }), 300, NO_SIZE),
    ).toBeNull();
  });
});

describe("artworkGuidance", () => {
  it("names the pixels a shopper needs at the size they are ordering", () => {
    expect(artworkGuidance(300, { widthInches: 3, heightInches: 3 })).toContain(
      "900 pixels across (300 DPI)",
    );
  });

  it("quotes the axis that asks the most, so meeting it is enough", () => {
    // Quoting the 8" width of a 40" banner would have the shopper supply a
    // file that still fails.
    expect(
      artworkGuidance(300, { widthInches: 8, heightInches: 40 }),
    ).toContain("12,000 pixels down");
  });

  it("falls back to the formats and the limit when no size is known", () => {
    const guidance = artworkGuidance(300, NO_SIZE);

    expect(guidance).toContain("PNG, JPG, WEBP, SVG, PDF or AI");
    expect(guidance).toContain("25 MB");
    expect(guidance).not.toContain("DPI");
  });
});
