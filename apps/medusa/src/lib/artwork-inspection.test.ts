import {
  ARTWORK_HEADER_BYTES,
  inspectArtworkBytes,
  sniffArtworkFormat,
} from "./artwork-inspection.js";

// Real encoder output, not bytes packed by hand here — a fixture built the way
// the reader reads could only ever agree with it. The PNG and JPEG are one
// 7x3 image written by macOS `sips`, so both carry the EXIF and XMP segments a
// phone export does and the JPEG's marker walk has to step over them. The three
// WebPs are the published 1x1 feature-detection images, one per chunk type.
const PNG_7X3 =
  "iVBORw0KGgoAAAANSUhEUgAAAAcAAAADCAIAAADQoYKSAAAAAXNSR0IArs4c6QAAAERlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAB6ADAAQAAAABAAAAAwAAAAAk1nmWAAABx2lUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iWE1QIENvcmUgNi4wLjAiPgogICA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPgogICAgICA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIgogICAgICAgICAgICB4bWxuczpleGlmPSJodHRwOi8vbnMuYWRvYmUuY29tL2V4aWYvMS4wLyI+CiAgICAgICAgIDxleGlmOkNvbG9yU3BhY2U+MTwvZXhpZjpDb2xvclNwYWNlPgogICAgICAgICA8ZXhpZjpQaXhlbFhEaW1lbnNpb24+NzwvZXhpZjpQaXhlbFhEaW1lbnNpb24+CiAgICAgICAgIDxleGlmOlBpeGVsWURpbWVuc2lvbj4zPC9leGlmOlBpeGVsWURpbWVuc2lvbj4KICAgICAgPC9yZGY6RGVzY3JpcHRpb24+CiAgIDwvcmRmOlJERj4KPC94OnhtcG1ldGE+Ct1Apx8AAAAUSURBVAgdY/zHgAUwYRFjYMAuCgBBhgEEOCTW6gAAAABJRU5ErkJggg==";

const JPEG_7X3 =
  "/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAB6ADAAQAAAABAAAAAwAAAAD/7QA4UGhvdG9zaG9wIDMuMAA4QklNBAQAAAAAAAA4QklNBCUAAAAAABDUHYzZjwCyBOmACZjs+EJ+/8AAEQgAAwAHAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/bAEMAAgICAgICAwICAwUDAwMFBgUFBQUGCAYGBgYGCAoICAgICAgKCgoKCgoKCgwMDAwMDA4ODg4ODw8PDw8PDw8PD//bAEMBAgICBAQEBwQEBxALCQsQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEP/dAAQAAf/aAAwDAQACEQMRAD8A+L6KKK/lM/38P//Z";

const WEBP_LOSSY_1X1 =
  "UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA";
const WEBP_LOSSLESS_1X1 = "UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==";
const WEBP_ALPHA_1X1 =
  "UklGRkoAAABXRUJQVlA4WAoAAAAQAAAAAAAAAAAAQUxQSAwAAAARBxAR/Q9ERP8DAABWUDggGAAAABQBAJ0BKgEAAQAAAP4AAA3AAP7mtQAAAA==";

function bytes(base64: string): Uint8Array {
  return new Uint8Array(Buffer.from(base64, "base64"));
}

function text(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, "utf8"));
}

const PDF = text("%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n");
const POSTSCRIPT = text("%!PS-Adobe-3.0\n%%Creator: Adobe Illustrator\n");
const SVG = text(
  '<?xml version="1.0" encoding="UTF-8"?>\n<!-- exported -->\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>',
);

// A colour profile or an embedded thumbnail rides in APP segments ahead of the
// start-of-frame marker, and each segment caps at 64 KB, so a wide-gamut export
// splits one profile across several. Real encoder bytes, only pushed further
// down the file — the marker walk has to keep going to find them.
function withLargeColourProfile(base64: string): Uint8Array {
  const jpeg = bytes(base64);
  const chunk = new Uint8Array(65_000);
  const segment = new Uint8Array(chunk.length + 4);
  segment.set([0xff, 0xe2, 0xfe, 0x0e]);
  segment.set(chunk, 4);

  const parts = [jpeg.subarray(0, 2)];
  for (let i = 0; i < 6; i += 1) parts.push(segment);
  parts.push(jpeg.subarray(2));

  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const padded = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    padded.set(part, offset);
    offset += part.length;
  }

  return padded;
}

describe("sniffArtworkFormat", () => {
  it.each([
    ["png", bytes(PNG_7X3)],
    ["jpeg", bytes(JPEG_7X3)],
    ["webp", bytes(WEBP_LOSSY_1X1)],
    ["pdf", PDF],
    ["postscript", POSTSCRIPT],
    ["svg", SVG],
  ])("reads %s from its own bytes", (format, input) => {
    expect(sniffArtworkFormat(input)).toBe(format);
  });

  it("reads nothing from a file that is not artwork at all", () => {
    expect(sniffArtworkFormat(text("just some notes"))).toBeNull();
  });
});

describe("inspectArtworkBytes", () => {
  it("measures a PNG whose header is followed by other chunks", () => {
    expect(inspectArtworkBytes(bytes(PNG_7X3), "image/png")).toEqual({
      ok: true,
      kind: "raster",
      format: "png",
      widthPx: 7,
      heightPx: 3,
    });
  });

  it("measures a JPEG by walking past its EXIF and Photoshop segments", () => {
    expect(inspectArtworkBytes(bytes(JPEG_7X3), "image/jpeg")).toEqual({
      ok: true,
      kind: "raster",
      format: "jpeg",
      widthPx: 7,
      heightPx: 3,
    });
  });

  it.each([
    ["lossy VP8", WEBP_LOSSY_1X1],
    ["lossless VP8L", WEBP_LOSSLESS_1X1],
    ["extended VP8X", WEBP_ALPHA_1X1],
  ])("measures a %s WebP", (_label, base64) => {
    const result = inspectArtworkBytes(bytes(base64), "image/webp");

    expect(result).toMatchObject({ ok: true, widthPx: 1, heightPx: 1 });
  });

  it.each([
    ["image/svg+xml" as const, SVG, "svg"],
    ["application/pdf" as const, PDF, "pdf"],
    ["application/illustrator" as const, PDF, "pdf"],
    ["application/illustrator" as const, POSTSCRIPT, "postscript"],
  ])(
    "reports %s as vector, with no dimensions to measure",
    (mimeType, input, format) => {
      expect(inspectArtworkBytes(input, mimeType)).toEqual({
        ok: true,
        kind: "vector",
        format,
        widthPx: null,
        heightPx: null,
      });
    },
  );

  it("rejects a file whose bytes contradict its declared type", () => {
    // The presigned PUT cannot bind Content-Type, so this claim is all the
    // upload route ever had to go on.
    expect(inspectArtworkBytes(bytes(JPEG_7X3), "image/png")).toEqual({
      ok: false,
      reason: "mismatched_type",
    });
    expect(inspectArtworkBytes(PDF, "image/png")).toEqual({
      ok: false,
      reason: "mismatched_type",
    });
  });

  it("rejects a renamed text file rather than reading nothing from it", () => {
    expect(inspectArtworkBytes(text("not a picture"), "image/png")).toEqual({
      ok: false,
      reason: "mismatched_type",
    });
  });

  it("rejects a raster whose header is truncated, never guessing a size", () => {
    // Passing an unmeasurable file would open the one hole this gate exists to
    // close: no dimensions means no DPI check means nothing blocks it.
    const truncated = bytes(PNG_7X3).subarray(0, 16);

    expect(inspectArtworkBytes(truncated, "image/png")).toEqual({
      ok: false,
      reason: "unreadable",
    });
  });

  it("measures a JPEG whose colour profile pushes the frame marker far in", () => {
    const padded = withLargeColourProfile(JPEG_7X3);

    expect(padded.length).toBeGreaterThan(ARTWORK_HEADER_BYTES);
    expect(inspectArtworkBytes(padded, "image/jpeg")).toMatchObject({
      ok: true,
      widthPx: 7,
      heightPx: 3,
    });
  });

  it("reports a JPEG cut short of its frame marker as unreadable, not mismatched", () => {
    // The route relies on this distinction: unreadable is worth re-reading the
    // whole object for, a wrong signature at offset zero is not.
    const head = withLargeColourProfile(JPEG_7X3).subarray(
      0,
      ARTWORK_HEADER_BYTES,
    );

    expect(inspectArtworkBytes(head, "image/jpeg")).toEqual({
      ok: false,
      reason: "unreadable",
    });
  });

  it("reads an SVG whose opening tag sits behind a long licence header", () => {
    const svg = text(
      `<?xml version="1.0"?>\n<!--${"licence ".repeat(1000)}-->\n<svg xmlns="http://www.w3.org/2000/svg"></svg>`,
    );

    expect(inspectArtworkBytes(svg, "image/svg+xml")).toMatchObject({
      ok: true,
      kind: "vector",
    });
  });

  it("rejects a JPEG that never reaches a start-of-frame marker", () => {
    const headerOnly = bytes(JPEG_7X3).subarray(0, 40);

    expect(inspectArtworkBytes(headerOnly, "image/jpeg")).toEqual({
      ok: false,
      reason: "unreadable",
    });
  });
});
