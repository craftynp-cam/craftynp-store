import type { SiteContent } from "@craftynp/types";

import type {
  AboutClosingProps,
  AboutHeroProps,
  AboutStoryProps,
} from "@/components";

export function splitAboutParagraphs(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== "");
}

export function toAboutHero(content: SiteContent): AboutHeroProps {
  return {
    eyebrow: content.about_eyebrow,
    heading: content.about_heading,
    body: content.about_body,
    imageUrl: content.about_image,
    imageAlt: content.about_image_alt,
    ctaLabel: content.about_cta_label,
  };
}

export function toAboutStory(content: SiteContent): AboutStoryProps {
  return {
    heading: content.about_story_heading,
    paragraphs: splitAboutParagraphs(content.about_story_body),
  };
}

export function toAboutClosing(content: SiteContent): AboutClosingProps {
  return {
    heading: content.about_closing_heading,
    body: content.about_closing_body,
    ctaLabel: content.about_closing_cta_label,
  };
}
