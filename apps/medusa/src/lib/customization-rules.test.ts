import { DEFAULT_ARTWORK_MIN_DPI } from "@craftynp/types";

import { customizationRulesForVariant } from "./customization-rules";

const PRODUCT_METADATA = {
  customizable: "true",
  customization_artwork: "required",
  customization_size: "optional",
  customization_size_min_inches: "2",
  customization_size_max_inches: "48",
  customization_text_max_length: "40",
};

function variant(
  overrides: {
    categories?: ({ metadata?: Record<string, unknown> | null } | null)[];
    options?: ({ metadata?: Record<string, unknown> | null } | null)[];
  } = {},
) {
  return {
    id: "variant_01",
    product: {
      metadata: PRODUCT_METADATA,
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
