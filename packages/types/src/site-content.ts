import { z } from "zod";

export type SiteContentFieldType = "text" | "longText" | "boolean";

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
