import { z } from "zod";

export type SiteContentFieldType = "text" | "longText" | "boolean" | "image";

export type SiteContentField = {
  key: string;
  type: SiteContentFieldType;
  group: string;
  label: string;
  description: string;
  defaultValue: string;
  maxLength?: number;
};

export const SITE_CONTENT_FIELDS = [
  {
    key: "banner_enabled",
    type: "boolean",
    group: "Announcement bar",
    label: "Show the announcement bar",
    description: "Turn the bar above the header on or off.",
    defaultValue: "false",
  },
  {
    key: "banner_text",
    type: "text",
    group: "Announcement bar",
    label: "Announcement text",
    description: "One line shown across the top of every page.",
    defaultValue: "",
    maxLength: 200,
  },
  {
    key: "workshop_heading",
    type: "text",
    group: "Fresh from the workshop",
    label: "Section heading",
    description: "Sits above the gallery on the homepage.",
    defaultValue: "Fresh from the workshop",
    maxLength: 80,
  },
  {
    key: "workshop_intro",
    type: "text",
    group: "Fresh from the workshop",
    label: "Section intro",
    description: "One line shown under the heading.",
    defaultValue:
      "Real pieces we've made — the customization result, not a mockup.",
    maxLength: 160,
  },
  {
    key: "workshop_image_1",
    type: "image",
    group: "Fresh from the workshop",
    label: "Tile 1 image",
    description:
      "Square works best. Leave empty to hide this tile. Uploads immediately — shows on the site after Save.",
    defaultValue: "",
    maxLength: 512,
  },
  {
    key: "workshop_caption_1",
    type: "text",
    group: "Fresh from the workshop",
    label: "Tile 1 caption",
    description: "Also used as the image's alt text.",
    defaultValue: "",
    maxLength: 80,
  },
  {
    key: "workshop_image_2",
    type: "image",
    group: "Fresh from the workshop",
    label: "Tile 2 image",
    description:
      "Square works best. Leave empty to hide this tile. Uploads immediately — shows on the site after Save.",
    defaultValue: "",
    maxLength: 512,
  },
  {
    key: "workshop_caption_2",
    type: "text",
    group: "Fresh from the workshop",
    label: "Tile 2 caption",
    description: "Also used as the image's alt text.",
    defaultValue: "",
    maxLength: 80,
  },
  {
    key: "workshop_image_3",
    type: "image",
    group: "Fresh from the workshop",
    label: "Tile 3 image",
    description:
      "Square works best. Leave empty to hide this tile. Uploads immediately — shows on the site after Save.",
    defaultValue: "",
    maxLength: 512,
  },
  {
    key: "workshop_caption_3",
    type: "text",
    group: "Fresh from the workshop",
    label: "Tile 3 caption",
    description: "Also used as the image's alt text.",
    defaultValue: "",
    maxLength: 80,
  },
  {
    key: "workshop_image_4",
    type: "image",
    group: "Fresh from the workshop",
    label: "Tile 4 image",
    description:
      "Square works best. Leave empty to hide this tile. Uploads immediately — shows on the site after Save.",
    defaultValue: "",
    maxLength: 512,
  },
  {
    key: "workshop_caption_4",
    type: "text",
    group: "Fresh from the workshop",
    label: "Tile 4 caption",
    description: "Also used as the image's alt text.",
    defaultValue: "",
    maxLength: 80,
  },
  {
    key: "maker_eyebrow",
    type: "text",
    group: "About the maker",
    label: "Eyebrow",
    description: "Small uppercase label shown above the heading.",
    defaultValue: "About the maker",
    maxLength: 40,
  },
  {
    key: "maker_heading",
    type: "text",
    group: "About the maker",
    label: "Heading",
    description: "The section's main heading.",
    defaultValue: "Hi, I'm the one behind every order",
    maxLength: 100,
  },
  {
    key: "maker_body",
    type: "longText",
    group: "About the maker",
    label: "Body copy",
    description: "One paragraph introducing the maker.",
    defaultValue:
      "The Crafty NP started as a kitchen-table hobby and grew into a full workshop. I cut, press, and pack every piece myself — and I'll always send you a proof before anything gets printed.",
    maxLength: 600,
  },
  {
    key: "maker_image",
    type: "image",
    group: "About the maker",
    label: "Portrait",
    description:
      "Portrait orientation works best. Uploads immediately — shows on the site after Save.",
    defaultValue: "",
    maxLength: 512,
  },
  {
    key: "maker_image_alt",
    type: "text",
    group: "About the maker",
    label: "Portrait alt text",
    description: "Describes the photo for screen readers.",
    defaultValue: "The maker at her workbench",
    maxLength: 120,
  },
  {
    key: "maker_link_label",
    type: "text",
    group: "About the maker",
    label: "Link label",
    description: "Text for the link to the about page.",
    defaultValue: "Read the full story",
    maxLength: 40,
  },
] as const satisfies readonly SiteContentField[];

export type SiteContentKey = (typeof SITE_CONTENT_FIELDS)[number]["key"];

export const SITE_CONTENT_KEYS = SITE_CONTENT_FIELDS.map(
  (field) => field.key,
) as [SiteContentKey, ...SiteContentKey[]];

export const siteContentKeySchema = z.enum(SITE_CONTENT_KEYS);

export const siteContentEntrySchema = z.object({
  key: siteContentKeySchema,
  value: z.string(),
});
export type SiteContentEntry = z.infer<typeof siteContentEntrySchema>;

export const siteContentUpdateSchema = z.object({
  entries: z.array(siteContentEntrySchema).min(1),
});
export type SiteContentUpdate = z.infer<typeof siteContentUpdateSchema>;

export type SiteContentFieldValue<Field extends SiteContentFieldType> =
  Field extends "boolean" ? boolean : string;

export type SiteContent = {
  [K in SiteContentKey]: SiteContentFieldValue<
    Extract<(typeof SITE_CONTENT_FIELDS)[number], { key: K }>["type"]
  >;
};

function findField(key: SiteContentKey): SiteContentField {
  const field = SITE_CONTENT_FIELDS.find((candidate) => candidate.key === key);
  if (!field) {
    throw new Error(`Unknown site content key: ${key}`);
  }
  return field;
}

function isAllowedImageUrl(value: string): boolean {
  return value.startsWith("/") || /^https?:\/\//i.test(value);
}

export function validateSiteContentValue(
  key: SiteContentKey,
  value: string,
): { success: true; value: string } | { success: false; message: string } {
  const field = findField(key);

  if (field.type === "boolean") {
    if (value !== "true" && value !== "false") {
      return {
        success: false,
        message: `${key} must be "true" or "false"`,
      };
    }
    return { success: true, value };
  }

  const trimmed = value.trim();
  if (field.maxLength != null && trimmed.length > field.maxLength) {
    return {
      success: false,
      message: `${key} must be at most ${field.maxLength} characters`,
    };
  }

  if (field.type === "image" && trimmed !== "" && !isAllowedImageUrl(trimmed)) {
    return {
      success: false,
      message: `${key} must be an image URL`,
    };
  }

  return { success: true, value: trimmed };
}

function coerceFieldValue(
  field: SiteContentField,
  rawValue: string,
): string | boolean {
  if (field.type === "boolean") {
    return rawValue === "true";
  }
  return rawValue;
}

export type SiteContentEntrySource = { key: string; value: string };

export function resolveSiteContent(
  entries: readonly SiteContentEntrySource[],
): SiteContent {
  const values = new Map(entries.map((entry) => [entry.key, entry.value]));

  return Object.fromEntries(
    SITE_CONTENT_FIELDS.map((field) => [
      field.key,
      coerceFieldValue(field, values.get(field.key) ?? field.defaultValue),
    ]),
  ) as SiteContent;
}
