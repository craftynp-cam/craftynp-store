import { z } from "zod";

import { artworkMimeTypeSchema } from "./artwork.js";

export const MIN_ARTWORK_DPI = 150;

export const customTextSchema = z.object({
  value: z.string().trim().min(1).max(120),
});
export type CustomText = z.infer<typeof customTextSchema>;

export const artworkReferenceSchema = z.object({
  storageKey: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: artworkMimeTypeSchema,
  sizeBytes: z.number().int().positive(),
  widthPx: z.number().int().positive(),
  heightPx: z.number().int().positive(),
  dpi: z.number().int().min(MIN_ARTWORK_DPI),
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

export const lineItemCustomizationSchema = z.object({
  customText: customTextSchema.optional(),
  artwork: artworkReferenceSchema.optional(),
  dimensions: customDimensionsSchema.optional(),
  orderNotes: z.string().trim().max(500).optional(),
});
export type LineItemCustomization = z.infer<typeof lineItemCustomizationSchema>;
