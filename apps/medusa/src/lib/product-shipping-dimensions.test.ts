import { MedusaError } from "@medusajs/framework/utils";

import {
  assertPublishableProducts,
  missingShippingFields,
  type ProductShippingDimensionsInput,
} from "./product-shipping-dimensions.js";

function product(
  overrides: Partial<ProductShippingDimensionsInput> = {},
): ProductShippingDimensionsInput {
  return {
    id: "prod_1",
    title: "Medusa T-Shirt",
    status: "published",
    weight: 400,
    length: 30,
    width: 25,
    height: 5,
    ...overrides,
  };
}

describe("missingShippingFields", () => {
  it("returns an empty list when all four fields are present", () => {
    expect(missingShippingFields(product())).toEqual([]);
  });

  it.each(["weight", "length", "width", "height"] as const)(
    "reports %s missing when it is null",
    (field) => {
      expect(missingShippingFields(product({ [field]: null }))).toContain(
        field,
      );
    },
  );

  it("treats zero as missing", () => {
    expect(missingShippingFields(product({ weight: 0 }))).toContain("weight");
  });

  it("treats a negative value as missing", () => {
    expect(missingShippingFields(product({ length: -1 }))).toContain("length");
  });
});

describe("assertPublishableProducts", () => {
  it("passes a draft product missing every dimension", () => {
    expect(() =>
      assertPublishableProducts([
        product({
          status: "draft",
          weight: null,
          length: null,
          width: null,
          height: null,
        }),
      ]),
    ).not.toThrow();
  });

  it("passes a published product with all four dimensions", () => {
    expect(() => assertPublishableProducts([product()])).not.toThrow();
  });

  it("throws MedusaError.Types.INVALID_DATA naming a single missing field", () => {
    expect(() =>
      assertPublishableProducts([product({ weight: null })]),
    ).toThrow(MedusaError);

    try {
      assertPublishableProducts([product({ weight: null })]);
    } catch (error) {
      expect((error as Error).message).toContain("Medusa T-Shirt");
      expect((error as Error).message).toContain("weight (grams)");
    }
  });

  it("names every missing field for a product missing several", () => {
    try {
      assertPublishableProducts([
        product({ length: null, width: null, height: null }),
      ]);
      throw new Error("expected assertPublishableProducts to throw");
    } catch (error) {
      expect((error as Error).message).toContain("length, width, height (cm)");
    }
  });

  it("names every failing product when several fail at once", () => {
    try {
      assertPublishableProducts([
        product({ id: "prod_1", title: "Sweatshirt", weight: null }),
        product({ id: "prod_2", title: "Sweatpants", length: null }),
      ]);
      throw new Error("expected assertPublishableProducts to throw");
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain("Sweatshirt");
      expect(message).toContain("Sweatpants");
    }
  });
});
