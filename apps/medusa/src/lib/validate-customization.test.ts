import { MedusaError } from "@medusajs/framework/utils";
import { validateCustomization } from "./validate-customization.js";

const lowDpiArtwork = {
  artwork: {
    storageKey: "artwork/a.png",
    fileName: "a.png",
    mimeType: "image/png",
    sizeBytes: 1024,
    widthPx: 100,
    heightPx: 100,
    dpi: 72,
  },
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
    const result = validateCustomization({
      customText: { value: "For Grandma" },
      orderNotes: "Gift wrap please",
    });

    expect(result.customText?.value).toBe("For Grandma");
    expect(result.orderNotes).toBe("Gift wrap please");
  });

  it("accepts an empty payload for a ready-made product", () => {
    expect(validateCustomization({})).toEqual({});
  });

  it("throws when custom text is empty", () => {
    expect(() => validateCustomization({ customText: { value: "" } })).toThrow(
      /Invalid line item customization/,
    );
    expect(() => validateCustomization({ customText: { value: "" } })).toThrow(
      MedusaError,
    );
  });

  it("names the offending field in the error message", () => {
    expect(() => validateCustomization({ customText: { value: "" } })).toThrow(
      /customText\.value/,
    );
  });

  it("throws when artwork is below the minimum DPI", () => {
    expect(() => validateCustomization(lowDpiArtwork)).toThrow(/dpi/);
    expect(() => validateCustomization(lowDpiArtwork)).toThrow(MedusaError);
  });

  it("throws on a non-object payload", () => {
    expect(() => validateCustomization("nope")).toThrow(
      /Invalid line item customization/,
    );
    expect(() => validateCustomization("nope")).toThrow(MedusaError);
  });

  // A plain Error carrying the same message would satisfy every assertion above
  // except these. The error type is what maps the failure to a 400 rather than
  // a 500, so it is asserted directly.
  describe("error type", () => {
    it.each([
      ["empty custom text", { customText: { value: "" } }],
      ["artwork below the minimum DPI", lowDpiArtwork],
      ["a non-object payload", "nope"],
    ])("is INVALID_DATA for %s", (_label, payload) => {
      const thrown = captureThrown(() => validateCustomization(payload));

      expect(thrown).toBeInstanceOf(MedusaError);
      expect((thrown as MedusaError).type).toBe(MedusaError.Types.INVALID_DATA);
    });
  });
});
