import { resolveProductCustomization } from "@craftynp/types";

import {
  EMPTY_CUSTOMIZATION_DRAFT,
  missingInputsMessage,
  missingRequiredInputs,
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

describe("missingInputsMessage", () => {
  it("says nothing when nothing is missing", () => {
    expect(missingInputsMessage([])).toBeNull();
  });

  it("names a single missing input", () => {
    expect(missingInputsMessage(["artwork"])).toBe(
      "Add your artwork to continue.",
    );
  });

  it("joins several with commas and a final and", () => {
    expect(missingInputsMessage(["artwork", "customText", "dimensions"])).toBe(
      "Add your artwork, your custom text and a width and height to continue.",
    );
  });
});
