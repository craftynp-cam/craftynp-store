import {
  ARTWORK_ACCEPT,
  MAX_ARTWORK_BYTES,
  artworkExtension,
  artworkUploadRequestSchema,
  isVectorArtwork,
  resolveArtworkMimeType,
} from "./artwork.js";

const validRequest = {
  fileName: "logo.png",
  mimeType: "image/png",
  sizeBytes: 4096,
};

describe("artworkUploadRequestSchema", () => {
  it("accepts a valid request", () => {
    const result = artworkUploadRequestSchema.safeParse(validRequest);
    expect(result.success).toBe(true);
  });

  it("accepts a file exactly at the size limit", () => {
    const result = artworkUploadRequestSchema.safeParse({
      ...validRequest,
      sizeBytes: MAX_ARTWORK_BYTES,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a file over the size limit, which is what stops one presign becoming unbounded storage", () => {
    const result = artworkUploadRequestSchema.safeParse({
      ...validRequest,
      sizeBytes: MAX_ARTWORK_BYTES + 1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a zero-byte file", () => {
    const result = artworkUploadRequestSchema.safeParse({
      ...validRequest,
      sizeBytes: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a type the shop cannot print", () => {
    const result = artworkUploadRequestSchema.safeParse({
      ...validRequest,
      mimeType: "image/gif",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a file name that is only whitespace", () => {
    const result = artworkUploadRequestSchema.safeParse({
      ...validRequest,
      fileName: "   ",
    });
    expect(result.success).toBe(false);
  });
});

describe("artworkExtension", () => {
  it("maps jpeg to jpg, so a stored key carries the extension people expect", () => {
    expect(artworkExtension("image/jpeg")).toBe("jpg");
  });
});

describe("resolveArtworkMimeType", () => {
  it("reads an Illustrator file the browser reported as a PDF", () => {
    // Chrome on macOS reports application/pdf for .ai, so trusting File.type
    // stores the file under the wrong extension and calls it a PDF everywhere.
    expect(resolveArtworkMimeType("brand.ai", "application/pdf")).toBe(
      "application/illustrator",
    );
  });

  it("reads a file the browser gave no type at all", () => {
    expect(resolveArtworkMimeType("brand.ai", "")).toBe(
      "application/illustrator",
    );
    expect(resolveArtworkMimeType("photo.WEBP", "")).toBe("image/webp");
  });

  it("treats .jpeg and .jpg as the same type", () => {
    expect(resolveArtworkMimeType("shot.jpeg", "")).toBe("image/jpeg");
    expect(resolveArtworkMimeType("shot.jpg", "")).toBe("image/jpeg");
  });

  it("falls back to the browser's type when the extension says nothing", () => {
    expect(resolveArtworkMimeType("scan", "image/png")).toBe("image/png");
  });

  it("rejects a file that is neither an accepted extension nor an accepted type", () => {
    expect(resolveArtworkMimeType("notes.txt", "text/plain")).toBeNull();
    expect(resolveArtworkMimeType("clip.gif", "image/gif")).toBeNull();
  });
});

describe("isVectorArtwork", () => {
  it("separates the formats with a fixed resolution from the ones without", () => {
    expect(isVectorArtwork("image/png")).toBe(false);
    expect(isVectorArtwork("image/webp")).toBe(false);
    expect(isVectorArtwork("image/svg+xml")).toBe(true);
    expect(isVectorArtwork("application/pdf")).toBe(true);
    expect(isVectorArtwork("application/illustrator")).toBe(true);
  });
});

describe("ARTWORK_ACCEPT", () => {
  it("offers extensions as well as types, since .ai has no reliable one", () => {
    expect(ARTWORK_ACCEPT).toContain(".ai");
    expect(ARTWORK_ACCEPT).toContain(".jpeg");
    expect(ARTWORK_ACCEPT).toContain("image/webp");
  });
});
