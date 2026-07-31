import { resolveSiteContent } from "@craftynp/types";
import type { SiteContent } from "@craftynp/types";

import { toMakerIntro, toWorkshopGallery } from "@/lib/home-content";

function fullContent(overrides: Partial<SiteContent> = {}): SiteContent {
  return {
    ...resolveSiteContent([
      { key: "workshop_image_1", value: "https://example.com/1.png" },
      { key: "workshop_caption_1", value: "Printed tee" },
      { key: "workshop_image_2", value: "https://example.com/2.png" },
      { key: "workshop_caption_2", value: "Engraved keychain" },
      { key: "workshop_image_3", value: "https://example.com/3.png" },
      { key: "workshop_caption_3", value: "Die-cut sticker" },
      { key: "workshop_image_4", value: "https://example.com/4.png" },
      { key: "workshop_caption_4", value: "Event banner" },
    ]),
    ...overrides,
  };
}

describe("toWorkshopGallery", () => {
  it("maps all four tiles in slot order", () => {
    const result = toWorkshopGallery(fullContent());
    expect(result.tiles.map((tile) => tile.id)).toEqual(["1", "2", "3", "4"]);
    expect(result.tiles[0]).toEqual({
      id: "1",
      imageUrl: "https://example.com/1.png",
      caption: "Printed tee",
    });
  });

  it("filters out tiles with no image", () => {
    const content = fullContent({ workshop_image_2: "" });
    const result = toWorkshopGallery(content);
    expect(result.tiles.map((tile) => tile.id)).toEqual(["1", "3", "4"]);
  });

  it("returns an empty tiles array when every image is blank", () => {
    const result = toWorkshopGallery(resolveSiteContent([]));
    expect(result.tiles).toEqual([]);
  });
});

describe("toMakerIntro", () => {
  it("maps every maker field 1:1", () => {
    const content = resolveSiteContent([
      { key: "maker_eyebrow", value: "About the maker" },
      { key: "maker_heading", value: "Hi there" },
      { key: "maker_body", value: "Some body copy." },
      { key: "maker_image", value: "https://example.com/maker.png" },
      { key: "maker_image_alt", value: "The maker" },
      { key: "maker_link_label", value: "Read more" },
    ]);

    expect(toMakerIntro(content)).toEqual({
      eyebrow: "About the maker",
      heading: "Hi there",
      body: "Some body copy.",
      imageUrl: "https://example.com/maker.png",
      imageAlt: "The maker",
      linkLabel: "Read more",
    });
  });

  it("uses the registry defaults when nothing is stored", () => {
    const result = toMakerIntro(resolveSiteContent([]));
    expect(result.imageUrl).toBe("");
  });
});
