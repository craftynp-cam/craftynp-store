import {
  ARTWORK_ACCEPT,
  MAX_ARTWORK_BYTES,
  artworkExtension,
  artworkLineState,
  artworkUploadRequestSchema,
  isVectorArtwork,
  resolveArtworkMimeType,
  type ArtworkOrderAsset,
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

  it("rejects a file whose type the browser did give and we do not accept", () => {
    // Otherwise renaming notes.txt to logo.png would talk its way past the
    // client-side check. Only .ai overrides a type the browser supplied.
    expect(resolveArtworkMimeType("logo.png", "text/plain")).toBeNull();
  });

  it("rejects a dropped folder, which arrives with no type and no extension", () => {
    expect(resolveArtworkMimeType("Designs", "")).toBeNull();
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

describe("artworkLineState", () => {
  const entry = (
    overrides: Partial<ArtworkOrderAsset> = {},
  ): ArtworkOrderAsset => ({
    id: "claim_2",
    fileName: "logo.png",
    mimeType: "image/png",
    sizeBytes: 51_200,
    lineItemId: "li_2",
    uploadedAt: "2026-09-10T12:00:00.000Z",
    promotedAt: "2026-09-11T12:00:00.000Z",
    purgedAt: null,
    purgeReason: null,
    ...overrides,
  });

  it("offers the line's own filed copy for download", () => {
    expect(artworkLineState(entry())).toEqual({
      kind: "download",
      claimId: "claim_2",
    });
  });

  it("keeps a claimed line that is not yet filed waiting, rather than offering a download that cannot work", () => {
    expect(artworkLineState(entry({ promotedAt: null }))).toEqual({
      kind: "filing",
    });
  });

  it("tells a line nothing has claimed apart from one waiting for its copy", () => {
    expect(artworkLineState(undefined)).toEqual({ kind: "unclaimed" });
  });

  it.each([
    ["staging_expired", "never_filed", null],
    ["changed_after_inspect", "replaced", null],
    ["delivered", "deleted", "2026-09-11T12:00:00.000Z"],
    ["undelivered", "deleted", "2026-09-11T12:00:00.000Z"],
  ])("reads a line purged as %s as %s", (purgeReason, kind, promotedAt) => {
    expect(
      artworkLineState(
        entry({
          promotedAt,
          purgedAt: "2026-10-11T12:00:00.000Z",
          purgeReason,
        }),
      ),
    ).toEqual({ kind });
  });
});
