import { z } from "zod";

export const ARTWORK_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/svg+xml",
  "application/pdf",
] as const;

export const artworkMimeTypeSchema = z.enum(ARTWORK_MIME_TYPES);
export type ArtworkMimeType = z.infer<typeof artworkMimeTypeSchema>;

export const MAX_ARTWORK_BYTES = 25 * 1024 * 1024;

export const ARTWORK_EXTENSIONS = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/svg+xml": "svg",
  "application/pdf": "pdf",
} as const satisfies Record<ArtworkMimeType, string>;

export function artworkExtension(mimeType: ArtworkMimeType): string {
  return ARTWORK_EXTENSIONS[mimeType];
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

export const artworkDownloadResponseSchema = z.object({
  url: z.string().url(),
  expiresAt: z.string().min(1),
  fileName: z.string().min(1),
});
export type ArtworkDownloadResponse = z.infer<
  typeof artworkDownloadResponseSchema
>;
