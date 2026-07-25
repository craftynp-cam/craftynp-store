import { z } from "zod";

/**
 * Minimum artwork resolution accepted by the configurator, in DPI.
 * Enforced by CNP-40; defined here so the storefront and backend agree.
 */
export const MIN_ARTWORK_DPI = 150;

/** Free-text personalization applied to a product. */
export const customTextSchema = z.object({
  value: z.string().trim().min(1).max(120),
});
export type CustomText = z.infer<typeof customTextSchema>;

/**
 * Pointer to an uploaded artwork file. The file itself lives in object storage
 * (CNP-20); only the reference travels with the line item.
 */
export const artworkReferenceSchema = z.object({
  storageKey: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: z.enum(["image/png", "image/jpeg", "image/svg+xml", "application/pdf"]),
  sizeBytes: z.number().int().positive(),
  widthPx: z.number().int().positive(),
  heightPx: z.number().int().positive(),
  dpi: z.number().int().min(MIN_ARTWORK_DPI),
});
export type ArtworkReference = z.infer<typeof artworkReferenceSchema>;

/** Buyer-specified dimensions, used when a product allows a custom size. */
export const customDimensionsSchema = z.object({
  widthInches: z.number().positive().max(96),
  heightInches: z.number().positive().max(96),
});
export type CustomDimensions = z.infer<typeof customDimensionsSchema>;

/**
 * The full customization payload attached to a cart line item. The storefront
 * builds it (CNP-45); the backend revalidates it before accepting the item.
 * Every field is optional because a ready-made product carries none of them.
 */
export const lineItemCustomizationSchema = z.object({
  customText: customTextSchema.optional(),
  artwork: artworkReferenceSchema.optional(),
  dimensions: customDimensionsSchema.optional(),
  orderNotes: z.string().trim().max(500).optional(),
});
export type LineItemCustomization = z.infer<typeof lineItemCustomizationSchema>;
