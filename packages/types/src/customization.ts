import { z } from "zod";

export const MIN_ARTWORK_DPI = 150;

export const customTextSchema = z.object({
  value: z.string().trim().min(1).max(120),
});
export type CustomText = z.infer<typeof customTextSchema>;

export const artworkReferenceSchema = z.object({
  storageKey: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: z.enum([
    "image/png",
    "image/jpeg",
    "image/svg+xml",
    "application/pdf",
  ]),
  sizeBytes: z.number().int().positive(),
  widthPx: z.number().int().positive(),
  heightPx: z.number().int().positive(),
  dpi: z.number().int().min(MIN_ARTWORK_DPI),
});
export type ArtworkReference = z.infer<typeof artworkReferenceSchema>;

export const customDimensionsSchema = z.object({
  widthInches: z.number().positive().max(96),
  heightInches: z.number().positive().max(96),
});
export type CustomDimensions = z.infer<typeof customDimensionsSchema>;

export const lineItemCustomizationSchema = z.object({
  customText: customTextSchema.optional(),
  artwork: artworkReferenceSchema.optional(),
  dimensions: customDimensionsSchema.optional(),
  orderNotes: z.string().trim().max(500).optional(),
});
export type LineItemCustomization = z.infer<typeof lineItemCustomizationSchema>;
