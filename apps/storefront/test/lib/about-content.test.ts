import { resolveSiteContent } from "@craftynp/types";

import {
  splitAboutParagraphs,
  toAboutClosing,
  toAboutHero,
  toAboutStory,
} from "@/lib/about-content";

describe("splitAboutParagraphs", () => {
  it("splits on a blank line into separate paragraphs", () => {
    expect(splitAboutParagraphs("First.\n\nSecond.")).toEqual([
      "First.",
      "Second.",
    ]);
  });

  it("returns a single paragraph unchanged when there is no blank line", () => {
    expect(splitAboutParagraphs("Just one paragraph.")).toEqual([
      "Just one paragraph.",
    ]);
  });

  it("returns an empty array for an empty string", () => {
    expect(splitAboutParagraphs("")).toEqual([]);
  });

  it("collapses extra blank lines and trims whitespace", () => {
    expect(splitAboutParagraphs("  First.  \n\n\n\n  Second.  ")).toEqual([
      "First.",
      "Second.",
    ]);
  });
});

describe("toAboutHero", () => {
  it("maps every hero field 1:1", () => {
    const content = resolveSiteContent([
      { key: "about_eyebrow", value: "The maker" },
      { key: "about_heading", value: "Hi there" },
      { key: "about_body", value: "Some body copy." },
      { key: "about_image", value: "https://example.com/maker.png" },
      { key: "about_image_alt", value: "The maker" },
      { key: "about_cta_label", value: "Shop now" },
    ]);

    expect(toAboutHero(content)).toEqual({
      eyebrow: "The maker",
      heading: "Hi there",
      body: "Some body copy.",
      imageUrl: "https://example.com/maker.png",
      imageAlt: "The maker",
      ctaLabel: "Shop now",
    });
  });

  it("uses the registry defaults when nothing is stored", () => {
    const result = toAboutHero(resolveSiteContent([]));
    expect(result.imageUrl).toBe("");
  });
});

describe("toAboutStory", () => {
  it("maps the heading and splits the body into paragraphs", () => {
    const content = resolveSiteContent([
      { key: "about_story_heading", value: "How it started" },
      { key: "about_story_body", value: "First.\n\nSecond." },
    ]);

    expect(toAboutStory(content)).toEqual({
      heading: "How it started",
      paragraphs: ["First.", "Second."],
    });
  });
});

describe("toAboutClosing", () => {
  it("maps every closing field 1:1", () => {
    const content = resolveSiteContent([
      { key: "about_closing_heading", value: "Let's make something" },
      { key: "about_closing_body", value: "Browse the shop." },
      { key: "about_closing_cta_label", value: "Shop the store" },
    ]);

    expect(toAboutClosing(content)).toEqual({
      heading: "Let's make something",
      body: "Browse the shop.",
      ctaLabel: "Shop the store",
    });
  });
});
