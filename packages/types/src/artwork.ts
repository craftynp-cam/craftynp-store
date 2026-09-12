import { z } from "zod";

export const ARTWORK_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
  "application/illustrator",
] as const;

export const artworkMimeTypeSchema = z.enum(ARTWORK_MIME_TYPES);
export type ArtworkMimeType = z.infer<typeof artworkMimeTypeSchema>;

export const MAX_ARTWORK_BYTES = 25 * 1024 * 1024;

export const ARTWORK_EXTENSIONS = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "application/pdf": "pdf",
  "application/illustrator": "ai",
} as const satisfies Record<ArtworkMimeType, string>;

export function artworkExtension(mimeType: ArtworkMimeType): string {
  return ARTWORK_EXTENSIONS[mimeType];
}

export const ARTWORK_ACCEPTED_LABEL = "PNG, JPG, WEBP, SVG, PDF or AI";

export const ARTWORK_ACCEPT = [
  ...ARTWORK_MIME_TYPES,
  ...Object.values(ARTWORK_EXTENSIONS).map((extension) => `.${extension}`),
  ".jpeg",
].join(",");

export const VECTOR_ARTWORK_MIME_TYPES = [
  "image/svg+xml",
  "application/pdf",
  "application/illustrator",
] as const satisfies readonly ArtworkMimeType[];

export function isVectorArtwork(mimeType: string): boolean {
  return (VECTOR_ARTWORK_MIME_TYPES as readonly string[]).includes(mimeType);
}

export function isArtworkMimeType(value: string): value is ArtworkMimeType {
  return (ARTWORK_MIME_TYPES as readonly string[]).includes(value);
}

const EXTENSION_MIME_TYPES: Record<string, ArtworkMimeType> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml",
  pdf: "application/pdf",
  ai: "application/illustrator",
};

// Chrome on macOS reports an .ai file as application/pdf and Firefox reports
// nothing at all, so the extension has to answer in those two cases — it is
// the only thing that tells an Illustrator file from the PDF it is compatible
// with. Everywhere else a type the browser did give and we do not accept is a
// rejection, so renaming a text file to .png does not talk its way in.
export function resolveArtworkMimeType(
  fileName: string,
  fileType: string,
): ArtworkMimeType | null {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  const fromExtension = EXTENSION_MIME_TYPES[extension] ?? null;

  if (fromExtension === "application/illustrator") return fromExtension;
  if (isArtworkMimeType(fileType)) return fileType;
  return fileType === "" ? fromExtension : null;
}

export const artworkUploadRequestSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: artworkMimeTypeSchema,
  sizeBytes: z.number().int().positive().max(MAX_ARTWORK_BYTES),
});
export type ArtworkUploadRequest = z.infer<typeof artworkUploadRequestSchema>;

export const artworkUploadResponseSchema = z.object({
  uploadId: z.string().min(1),
  storageKey: z.string().min(1),
  uploadUrl: z.string().url(),
  expiresAt: z.string().min(1),
  requiredHeaders: z.object({
    "content-type": z.string().min(1),
    "content-length": z.string().min(1),
  }),
});
export type ArtworkUploadResponse = z.infer<typeof artworkUploadResponseSchema>;

export const ARTWORK_KINDS = ["raster", "vector"] as const;
export const artworkKindSchema = z.enum(ARTWORK_KINDS);
export type ArtworkKind = z.infer<typeof artworkKindSchema>;

export const artworkInspectResponseSchema = z.object({
  uploadId: z.string().min(1),
  kind: artworkKindSchema,
  widthPx: z.number().int().positive().nullable(),
  heightPx: z.number().int().positive().nullable(),
});
export type ArtworkInspectResponse = z.infer<
  typeof artworkInspectResponseSchema
>;

export const artworkDownloadResponseSchema = z.object({
  url: z.string().url(),
  expiresAt: z.string().min(1),
  fileName: z.string().min(1),
});
export type ArtworkDownloadResponse = z.infer<
  typeof artworkDownloadResponseSchema
>;

export const artworkOrderAssetSchema = z.object({
  id: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  lineItemId: z.string().nullable(),
  uploadedAt: z.string().min(1),
  promotedAt: z.string().nullable(),
  purgedAt: z.string().nullable(),
});
export type ArtworkOrderAsset = z.infer<typeof artworkOrderAssetSchema>;

export const artworkOrderListResponseSchema = z.object({
  artwork: z.array(artworkOrderAssetSchema),
});
export type ArtworkOrderListResponse = z.infer<
  typeof artworkOrderListResponseSchema
>;
