import { lineItemDetails } from "./line-item-details.js";

const ARTWORK = {
  storageKey: "staging/up_1.png",
  fileName: "flowers.png",
  mimeType: "image/png" as const,
  sizeBytes: 2048,
  widthPx: 1200,
  heightPx: 1200,
};

describe("lineItemDetails", () => {
  it("lists the options, then the artwork, text, size and notes, without the size option's own row", () => {
    expect(
      lineItemDetails({
        options: [
          { title: "Color", value: "Blush" },
          { title: "Size", value: "Custom" },
        ],
        customization: {
          orderNotes: "Matte finish",
          dimensions: { widthInches: 8, heightInches: 10 },
          customText: { value: "Ellie" },
          artwork: ARTWORK,
        },
        sizeOptionTitle: "Size",
      }),
    ).toEqual([
      { label: "Color", value: "Blush" },
      { label: "Artwork", value: "flowers.png" },
      { label: "Custom text", value: "Ellie" },
      { label: "Size", value: "8″ × 10″" },
      { label: "Order notes", value: "Matte finish" },
    ]);
  });

  it("keeps the size option's row while the customization records no size", () => {
    expect(
      lineItemDetails({
        options: [{ title: "Size", value: "Medium" }],
        customization: { customText: { value: "Ellie" } },
        sizeOptionTitle: "Size",
      }),
    ).toEqual([
      { label: "Size", value: "Medium" },
      { label: "Custom text", value: "Ellie" },
    ]);
  });

  it("writes a fractional size as typed and a whole one without padding", () => {
    expect(
      lineItemDetails({
        options: [],
        customization: { dimensions: { widthInches: 8.5, heightInches: 10 } },
        sizeOptionTitle: null,
      }),
    ).toEqual([{ label: "Size", value: "8.5″ × 10″" }]);
  });
});
