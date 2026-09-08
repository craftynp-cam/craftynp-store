import { artworkKeyOnLineItem } from "./promote-artwork.js";

describe("artworkKeyOnLineItem", () => {
  it("reads the staging key a configured line item carries", () => {
    expect(
      artworkKeyOnLineItem({
        id: "li_1",
        metadata: {
          customization: { artwork: { storageKey: "staging/01JX.png" } },
        },
      }),
    ).toBe("staging/01JX.png");
  });

  it.each([
    ["a ready-made item with no metadata", { id: "li_1", metadata: null }],
    ["an item with no customization", { id: "li_1", metadata: { note: "hi" } }],
    [
      "a customization with no artwork",
      {
        id: "li_1",
        metadata: { customization: { customText: { value: "a" } } },
      },
    ],
    [
      "an empty storage key",
      {
        id: "li_1",
        metadata: { customization: { artwork: { storageKey: "" } } },
      },
    ],
    [
      "a non-string storage key",
      {
        id: "li_1",
        metadata: { customization: { artwork: { storageKey: 7 } } },
      },
    ],
    [
      "customization that is not an object",
      { id: "li_1", metadata: { customization: "artwork/x.png" } },
    ],
  ])(
    "returns null for %s, so promotion skips it rather than throwing",
    (_label, item) => {
      expect(artworkKeyOnLineItem(item)).toBeNull();
    },
  );
});
