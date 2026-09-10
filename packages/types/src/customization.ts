import { z } from "zod";

import { artworkMimeTypeSchema, isVectorArtwork } from "./artwork.js";

export const customTextSchema = z.object({
  value: z.string().trim().min(1).max(120),
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

export function effectiveDpi(widthPx: number, widthInches: number): number {
  return Math.floor(widthPx / widthInches);
}

export function requiredPixelWidth(
  minDpi: number,
  widthInches: number,
): number {
  return Math.ceil(minDpi * widthInches);
}

export type ArtworkResolutionInput = {
  mimeType: string;
  widthPx: number | null;
};

export type ArtworkResolutionContext = {
  minDpi: number;
  orderedWidthInches: number | null;
};

export type ArtworkResolutionCheck =
  | { ok: true }
  | {
      ok: false;
      detectedDpi: number;
      requiredDpi: number;
      requiredWidthPx: number;
      message: string;
    };

function formatInches(inches: number): string {
  return `${Math.round(inches * 100) / 100}″`;
}

function formatPixels(pixels: number): string {
  return pixels.toLocaleString("en-US");
}

// A vector file has no fixed resolution, and an ordered width we cannot read is
// not a shopper's fault — neither can be checked, so neither blocks.
export function checkArtworkResolution(
  artwork: ArtworkResolutionInput,
  { minDpi, orderedWidthInches }: ArtworkResolutionContext,
): ArtworkResolutionCheck {
  if (isVectorArtwork(artwork.mimeType)) return { ok: true };
  if (orderedWidthInches === null || orderedWidthInches <= 0)
    return { ok: true };
  if (artwork.widthPx === null || artwork.widthPx <= 0) return { ok: true };

  const detectedDpi = effectiveDpi(artwork.widthPx, orderedWidthInches);
  if (detectedDpi >= minDpi) return { ok: true };

  const requiredWidthPx = requiredPixelWidth(minDpi, orderedWidthInches);

  return {
    ok: false,
    detectedDpi,
    requiredDpi: minDpi,
    requiredWidthPx,
    message:
      `This file works out at ${detectedDpi} DPI at ${formatInches(orderedWidthInches)} wide. ` +
      `We need at least ${minDpi} DPI — about ${formatPixels(requiredWidthPx)} pixels across. ` +
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
