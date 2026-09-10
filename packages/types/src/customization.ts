import { z } from "zod";

import { artworkMimeTypeSchema, isVectorArtwork } from "./artwork.js";

// The one limit for shopper-entered custom text. The storefront input and this
// schema are the same number by construction, so the field cannot promise a
// length the backend then refuses.
export const CUSTOM_TEXT_MAX_LENGTH = 120;

export const customTextSchema = z.object({
  value: z.string().trim().min(1).max(CUSTOM_TEXT_MAX_LENGTH),
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
  orderNotes: z.string().trim().max(500).optional(),
});
export type LineItemCustomization = z.infer<typeof lineItemCustomizationSchema>;
