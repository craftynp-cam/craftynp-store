import {
  MAX_ARTWORK_BYTES,
  artworkExtension,
  artworkUploadRequestSchema,
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
