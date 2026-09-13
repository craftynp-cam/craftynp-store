import { DEFAULT_ARTWORK_MIN_DPI } from "@craftynp/types";

import {
  customizationRulesForVariant,
  orderLineFactsForVariant,
} from "./customization-rules";
import { validateCustomization } from "./validate-customization";

const PRODUCT_METADATA = {
  customizable: "true",
  customization_artwork: "required",
  customization_size: "optional",
  customization_size_min_inches: "2",
  customization_size_max_inches: "48",
  customization_size_option: "Size",
  customization_size_option_value: "Custom",
  customization_text_max_length: "40",
};

type OptionRow = {
  value?: string | null;
  metadata?: Record<string, unknown> | null;
  option?: { title?: string | null } | null;
};

function variant(
  overrides: {
    metadata?: Record<string, unknown>;
    categories?: ({ metadata?: Record<string, unknown> | null } | null)[];
    options?: (OptionRow | null)[];
  } = {},
) {
  return {
    id: "variant_01",
    product: {
      metadata: overrides.metadata ?? PRODUCT_METADATA,
      categories: overrides.categories ?? [],
    },
    options: overrides.options ?? [],
  };
}

describe("customizationRulesForVariant", () => {
  it("reads the bounds and text limit off the product", () => {
    const rules = customizationRulesForVariant(variant());

    expect(rules.bounds).toEqual({ minInches: 2, maxInches: 48 });
    expect(rules.textMaxLength).toBe(40);
  });

  it("carries the product's input modes", () => {
    expect(customizationRulesForVariant(variant()).inputs).toEqual({
      artwork: "required",
      customText: "off",
      dimensions: "optional",
      orderNotes: "off",
    });
  });

  it.each([
    [
      "true on the named Custom value",
      PRODUCT_METADATA,
      [{ value: "Custom", option: { title: "Size" } }],
      true,
    ],
    [
      "false on a preset of the named option",
      PRODUCT_METADATA,
      [{ value: "Medium", option: { title: "Size" } }],
      false,
    ],
    [
      "false when the Custom value sits on another option",
      PRODUCT_METADATA,
      [{ value: "Custom", option: { title: "Finish" } }],
      false,
    ],
    [
      "null when the product names no Custom option",
      {
        ...PRODUCT_METADATA,
        customization_size_option: "",
        customization_size_option_value: "",
      },
      [{ value: "Custom", option: { title: "Size" } }],
      null,
    ],
    [
      "null when the custom size is off",
      { ...PRODUCT_METADATA, customization_size: "off" },
      [{ value: "Custom", option: { title: "Size" } }],
      null,
    ],
  ] as [string, Record<string, unknown>, OptionRow[], boolean | null][])(
    "reports the Custom variant as %s",
    (_label, metadata, options, expected) => {
      expect(
        customizationRulesForVariant(variant({ metadata, options }))
          .customSizeVariant,
      ).toBe(expected);
    },
  );

  it("measures artwork against the typed size on a Custom variant, not a stray preset measurement", () => {
    const rules = customizationRulesForVariant(
      variant({
        categories: [{ metadata: { artwork_min_dpi: "300" } }],
        options: [
          {
            value: "Custom",
            option: { title: "Size" },
            metadata: { width_inches: "1", height_inches: "1" },
          },
        ],
      }),
    );

    expect(() =>
      validateCustomization(
        {
          artwork: {
            storageKey: "staging/up_1.png",
            fileName: "logo.png",
            mimeType: "image/png",
            sizeBytes: 1024,
            widthPx: 600,
            heightPx: 600,
          },
          dimensions: { widthInches: 8, heightInches: 8 },
        },
        rules,
      ),
    ).toThrow(/75 DPI/);
  });

  it("takes the strictest artwork threshold among the product's categories", () => {
    const rules = customizationRulesForVariant(
      variant({
        categories: [
          { metadata: { artwork_min_dpi: "150" } },
          { metadata: { artwork_min_dpi: "300" } },
        ],
      }),
    );

    expect(rules.minDpi).toBe(300);
  });

  it("falls back to the default threshold for a product in no category", () => {
    expect(customizationRulesForVariant(variant()).minDpi).toBe(
      DEFAULT_ARTWORK_MIN_DPI,
    );
  });

  it("resolves a preset size from the variant's own option value metadata", () => {
    const rules = customizationRulesForVariant(
      variant({
        options: [
          { metadata: { subLabel: "Matte" } },
          { metadata: { width_inches: "8", height_inches: "10" } },
        ],
      }),
    );

    expect(rules.orderedSize).toEqual({ widthInches: 8, heightInches: 10 });
  });

  it("leaves the ordered size unknown when no option value measures one, so the typed dimensions answer", () => {
    const rules = customizationRulesForVariant(
      variant({ options: [{ metadata: { subLabel: "Matte" } }] }),
    );

    expect(rules.orderedSize).toEqual({
      widthInches: null,
      heightInches: null,
    });
  });
});

describe("orderLineFactsForVariant", () => {
  it("lists the variant's option values in the product's option order", () => {
    expect(
      orderLineFactsForVariant({
        id: "variant_01",
        product: {
          metadata: PRODUCT_METADATA,
          options: [{ id: "opt_finish" }, { id: "opt_size" }],
        },
        options: [
          {
            value: "Custom",
            option_id: "opt_size",
            option: { title: "Size" },
          },
          {
            value: "Matte",
            option_id: "opt_finish",
            option: { title: "Finish" },
          },
        ],
      }),
    ).toEqual({
      isCustomizable: true,
      options: [
        { title: "Finish", value: "Matte" },
        { title: "Size", value: "Custom" },
      ],
      sizeOptionTitle: "Size",
    });
  });
});
