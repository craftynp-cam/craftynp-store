import type { SiteContent } from "@craftynp/types";

import type {
  MakerIntroProps,
  WorkshopGalleryProps,
  WorkshopTile,
} from "@/components";

const TILE_SLOTS = ["1", "2", "3", "4"] as const;

export function toWorkshopGallery(content: SiteContent): WorkshopGalleryProps {
  const tiles: WorkshopTile[] = TILE_SLOTS.map((slot) => ({
    id: slot,
    imageUrl: content[`workshop_image_${slot}` as keyof SiteContent] as string,
    caption: content[`workshop_caption_${slot}` as keyof SiteContent] as string,
  })).filter((tile) => tile.imageUrl !== "");

  return {
    heading: content.workshop_heading,
    intro: content.workshop_intro,
    tiles,
  };
}

export function toMakerIntro(content: SiteContent): MakerIntroProps {
  return {
    eyebrow: content.maker_eyebrow,
    heading: content.maker_heading,
    body: content.maker_body,
    imageUrl: content.maker_image,
    imageAlt: content.maker_image_alt,
    linkLabel: content.maker_link_label,
  };
}
