import { validateCustomization } from "./validate-customization.js";

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
  });

  it("names the offending field in the error message", () => {
    expect(() => validateCustomization({ customText: { value: "" } })).toThrow(
      /customText\.value/,
    );
  });

  it("throws when artwork is below the minimum DPI", () => {
    expect(() =>
      validateCustomization({
        artwork: {
          storageKey: "artwork/a.png",
          fileName: "a.png",
          mimeType: "image/png",
          sizeBytes: 1024,
          widthPx: 100,
          heightPx: 100,
          dpi: 72,
        },
      }),
    ).toThrow(/dpi/);
  });

  it("throws on a non-object payload", () => {
    expect(() => validateCustomization("nope")).toThrow(
      /Invalid line item customization/,
    );
  });
});
