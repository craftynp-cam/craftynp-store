import { z } from "zod";

import { artworkMimeTypeSchema, isVectorArtwork } from "./artwork.js";

// What a shopper would call a character. A thumbs-up carrying a skin tone is
// four UTF-16 code units and one thing you can point at, and a counter that
// says 4 is a counter nobody believes. Both this schema and the storefront field count through
// here, so the number the field shows is the number the backend enforces.
// Where Intl.Segmenter is missing the count falls back to code units, which
// over-counts rather than under-counts — an old browser refuses text a beat
// early rather than sending text the backend will reject.
const graphemes =
  typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
    ? new Intl.Segmenter("en", { granularity: "grapheme" })
    : null;

export function textLength(value: string): number {
  const trimmed = value.trim();
  if (graphemes === null) return trimmed.length;

  return [...graphemes.segment(trimmed)].length;
}

// The limit a product falls back to when its owner has named none, and the
// most any owner may name. The ceiling is what customTextSchema stores; the
// product's own limit narrows it, the way custom size bounds narrow a
// positive number of inches.
export const CUSTOM_TEXT_FALLBACK_MAX_LENGTH = 120;
export const CUSTOM_TEXT_LENGTH_CEILING = 1000;

export const ORDER_NOTES_MAX_LENGTH = 500;

// The one message for text that runs long, shared by the field that shows it
// and the backend that rejects it.
export function checkTextLength(
  value: string,
  maxLength: number,
): string | null {
  const over = textLength(value) - maxLength;
  if (over <= 0) return null;

  return `Shorten this to ${maxLength} characters or fewer \u2014 ${over} ${over === 1 ? "character" : "characters"} over.`;
}

export const customTextSchema = z.object({
  value: z
    .string()
    .trim()
    .min(1)
    .refine((value) => textLength(value) <= CUSTOM_TEXT_LENGTH_CEILING, {
      message: `must be ${CUSTOM_TEXT_LENGTH_CEILING} characters or fewer`,
    }),
});
export type CustomText = z.infer<typeof customTextSchema>;

export const artworkReferenceSchema = z.object({
  storageKey: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: artworkMimeTypeSchema,
  sizeBytes: z.number().int().positive(),
  widthPx: z.number().int().positive().nullable(),
  heightPx: z.number().int().positive().nullable(),
});
export type ArtworkReference = z.infer<typeof artworkReferenceSchema>;

export const customDimensionsSchema = z.object({
  widthInches: z.number().positive(),
  heightInches: z.number().positive(),
});
export type CustomDimensions = z.infer<typeof customDimensionsSchema>;

export type CustomSizeBounds = {
  minInches: number;
  maxInches: number;
};

export type CustomDimensionField = "widthInches" | "heightInches";

export type CustomDimensionErrors = Partial<
  Record<CustomDimensionField, string>
>;

const DIMENSION_LABELS: Record<CustomDimensionField, string> = {
  widthInches: "width",
  heightInches: "height",
};

export function checkCustomDimensions(
  dimensions: CustomDimensions,
  bounds: CustomSizeBounds,
): CustomDimensionErrors {
  const errors: CustomDimensionErrors = {};

  for (const field of ["widthInches", "heightInches"] as const) {
    const value = dimensions[field];
    if (value < bounds.minInches || value > bounds.maxInches) {
      errors[field] =
        `Enter a ${DIMENSION_LABELS[field]} between ${bounds.minInches} and ${bounds.maxInches} inches.`;
    }
  }

  return errors;
}

export function effectiveDpi(pixels: number, inches: number): number {
  return Math.floor(pixels / inches);
}

export function requiredPixels(minDpi: number, inches: number): number {
  return Math.ceil(minDpi * inches);
}

export type ArtworkResolutionInput = {
  mimeType: string;
  widthPx: number | null;
  heightPx: number | null;
};

export type OrderedSizeInches = {
  widthInches: number | null;
  heightInches: number | null;
};

export type ArtworkResolutionContext = OrderedSizeInches & {
  minDpi: number;
};

export type ArtworkAxis = "width" | "height";

export type ArtworkResolutionDemand = {
  axis: ArtworkAxis;
  inches: number;
  pixels: number;
  dpi: number;
  requiredPx: number;
};

export type ArtworkResolutionCheck =
  | { ok: true }
  | {
      ok: false;
      detectedDpi: number;
      requiredDpi: number;
      axis: ArtworkAxis;
      requiredPx: number;
      message: string;
    };

const AXIS_WORDS: Record<ArtworkAxis, { extent: string; direction: string }> = {
  width: { extent: "wide", direction: "across" },
  height: { extent: "tall", direction: "down" },
};

function formatInches(inches: number): string {
  return `${Math.round(inches * 100) / 100}\u2033`;
}

function formatPixels(pixels: number): string {
  return pixels.toLocaleString("en-US");
}

function known(
  pixels: number | null,
  inches: number | null,
): { pixels: number; inches: number } | null {
  if (pixels === null || pixels <= 0) return null;
  if (inches === null || inches <= 0) return null;
  return { pixels, inches };
}

// Both axes are measured, not only the width. A 2400x600 file ordered at
// 8" x 40" clears 300 DPI across and prints at 15 DPI down the banner, and
// checking the width alone would call that acceptable.
export function artworkResolutionDemands(
  artwork: ArtworkResolutionInput,
  size: OrderedSizeInches,
  minDpi: number,
): ArtworkResolutionDemand[] {
  const axes: [ArtworkAxis, number | null, number | null][] = [
    ["width", artwork.widthPx, size.widthInches],
    ["height", artwork.heightPx, size.heightInches],
  ];

  return axes.flatMap(([axis, pixels, inches]) => {
    const pair = known(pixels, inches);
    if (pair === null) return [];

    return [
      {
        axis,
        inches: pair.inches,
        pixels: pair.pixels,
        dpi: effectiveDpi(pair.pixels, pair.inches),
        requiredPx: requiredPixels(minDpi, pair.inches),
      },
    ];
  });
}

// A vector file has no fixed resolution, and a dimension we cannot read is not
// a shopper's fault — neither can be checked, so neither blocks.
export function checkArtworkResolution(
  artwork: ArtworkResolutionInput,
  { minDpi, widthInches, heightInches }: ArtworkResolutionContext,
): ArtworkResolutionCheck {
  if (isVectorArtwork(artwork.mimeType)) return { ok: true };

  const demands = artworkResolutionDemands(
    artwork,
    { widthInches, heightInches },
    minDpi,
  );

  // The coarsest axis decides: clearing the floor one way over is no help if
  // the piece is starved the other way.
  const worst = demands.reduce<ArtworkResolutionDemand | null>(
    (lowest, demand) =>
      lowest === null || demand.dpi < lowest.dpi ? demand : lowest,
    null,
  );

  if (worst === null || worst.dpi >= minDpi) return { ok: true };

  const words = AXIS_WORDS[worst.axis];

  return {
    ok: false,
    detectedDpi: worst.dpi,
    requiredDpi: minDpi,
    axis: worst.axis,
    requiredPx: worst.requiredPx,
    message:
      `This file works out at ${worst.dpi} DPI at ${formatInches(worst.inches)} ${words.extent}. ` +
      `We need at least ${minDpi} DPI — about ${formatPixels(worst.requiredPx)} pixels ${words.direction}. ` +
      `Upload a higher-resolution file.`,
  };
}

export const lineItemCustomizationSchema = z.object({
  customText: customTextSchema.optional(),
  artwork: artworkReferenceSchema.optional(),
  dimensions: customDimensionsSchema.optional(),
  orderNotes: z
    .string()
    .trim()
    .refine((value) => textLength(value) <= ORDER_NOTES_MAX_LENGTH, {
      message: `must be ${ORDER_NOTES_MAX_LENGTH} characters or fewer`,
    })
    .optional(),
});
export type LineItemCustomization = z.infer<typeof lineItemCustomizationSchema>;
