import { resolveProductCustomization } from "@craftynp/types";

import {
  EMPTY_CUSTOMIZATION_DRAFT,
  customSizeErrors,
  customizationDetails,
  missingInputLabels,
  missingRequiredInputs,
  resolveCustomSizeOption,
  type CustomizationDraft,
} from "@/lib/product-customization";

const ARTWORK = {
  uploadId: "up_1",
  storageKey: "staging/up_1",
  fileName: "flowers.png",
  mimeType: "image/png" as const,
  sizeBytes: 2048,
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
