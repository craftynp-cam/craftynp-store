import { isVectorArtwork, type ArtworkMimeType } from "@craftynp/types";

export const ARTWORK_HEADER_BYTES = 64 * 1024;

export type ArtworkFormat =
  "png" | "jpeg" | "webp" | "svg" | "pdf" | "postscript";

export type ArtworkInspection =
  | {
      ok: true;
      kind: "raster";
      format: ArtworkFormat;
      widthPx: number;
      heightPx: number;
    }
  | {
      ok: true;
      kind: "vector";
      format: ArtworkFormat;
      widthPx: null;
      heightPx: null;
    }
  | { ok: false; reason: "mismatched_type" | "unreadable" };

// One declared type can be more than one thing on disk: an .ai file is a PDF
// with an Illustrator private data stream, and older ones are PostScript.
const ACCEPTED_FORMATS: Record<ArtworkMimeType, readonly ArtworkFormat[]> = {
  "image/png": ["png"],
  "image/jpeg": ["jpeg"],
  "image/webp": ["webp"],
  "image/svg+xml": ["svg"],
  "application/pdf": ["pdf"],
  "application/illustrator": ["pdf", "postscript"],
};

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((byte, index) => bytes[index] === byte);
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return Buffer.from(bytes.subarray(start, start + length)).toString("latin1");
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function looksLikeSvg(bytes: Uint8Array): boolean {
  // An SVG may open with a BOM, an XML declaration, a doctype or comments, so
  // the tag is looked for across the head rather than at offset zero.
  const head = Buffer.from(bytes.subarray(0, 2048)).toString("utf8");
  return /<svg[\s>]/i.test(head);
}

export function sniffArtworkFormat(bytes: Uint8Array): ArtworkFormat | null {
  if (startsWith(bytes, PNG_SIGNATURE)) return "png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
    return "webp";
  }
  if (ascii(bytes, 0, 4) === "%PDF") return "pdf";
  if (ascii(bytes, 0, 2) === "%!") return "postscript";
  if (looksLikeSvg(bytes)) return "svg";
  return null;
}

type Dimensions = { widthPx: number; heightPx: number };

function readPngDimensions(bytes: Uint8Array): Dimensions | null {
  // IHDR is required to be the first chunk, so width and height sit at fixed
  // offsets right after the signature and the chunk header.
  if (bytes.length < 24) return null;
  if (ascii(bytes, 12, 4) !== "IHDR") return null;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { widthPx: view.getUint32(16), heightPx: view.getUint32(20) };
}

const JPEG_SKIPPED_MARKERS = new Set([0xc4, 0xc8, 0xcc]);

function readJpegDimensions(bytes: Uint8Array): Dimensions | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2;

  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = bytes[offset + 1];
    if (marker === undefined || marker === 0xff) {
      offset += 1;
      continue;
    }

    // Standalone markers carry no length word to skip past.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      offset += 2;
      continue;
    }

    const length = view.getUint16(offset + 2);
    const isStartOfFrame =
      marker >= 0xc0 && marker <= 0xcf && !JPEG_SKIPPED_MARKERS.has(marker);

    if (isStartOfFrame) {
      return {
        heightPx: view.getUint16(offset + 5),
        widthPx: view.getUint16(offset + 7),
      };
    }

    if (length < 2) return null;
    offset += 2 + length;
  }

  return null;
}

function readWebpDimensions(bytes: Uint8Array): Dimensions | null {
  if (bytes.length < 30) return null;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunk = ascii(bytes, 12, 4);

  if (chunk === "VP8 ") {
    // The three-byte VP8 sync code, which is what tells a keyframe header from
    // any other chunk that happens to sit here.
    if (!startsWith(bytes.subarray(23), [0x9d, 0x01, 0x2a])) return null;
    return {
      widthPx: view.getUint16(26, true) & 0x3fff,
      heightPx: view.getUint16(28, true) & 0x3fff,
    };
  }

  if (chunk === "VP8L") {
    if (bytes[20] !== 0x2f) return null;
    const packed = view.getUint32(21, true);
    return {
      widthPx: (packed & 0x3fff) + 1,
      heightPx: ((packed >> 14) & 0x3fff) + 1,
    };
  }

  if (chunk === "VP8X") {
    const read24 = (start: number) =>
      (bytes[start] ?? 0) |
      ((bytes[start + 1] ?? 0) << 8) |
      ((bytes[start + 2] ?? 0) << 16);
    return { widthPx: read24(24) + 1, heightPx: read24(27) + 1 };
  }

  return null;
}

const RASTER_READERS: Partial<
  Record<ArtworkFormat, (bytes: Uint8Array) => Dimensions | null>
> = {
  png: readPngDimensions,
  jpeg: readJpegDimensions,
  webp: readWebpDimensions,
};

// The presigned PUT cannot bind Content-Type, so the declared type is only ever
// a claim. This is where the bytes get to answer, and it is the only automated
// gate between a bad file and a bad physical product.
export function inspectArtworkBytes(
  bytes: Uint8Array,
  declaredMimeType: ArtworkMimeType,
): ArtworkInspection {
  const format = sniffArtworkFormat(bytes);
  if (format === null) return { ok: false, reason: "mismatched_type" };
  if (!ACCEPTED_FORMATS[declaredMimeType].includes(format)) {
    return { ok: false, reason: "mismatched_type" };
  }

  if (isVectorArtwork(declaredMimeType)) {
    return { ok: true, kind: "vector", format, widthPx: null, heightPx: null };
  }

  const reader = RASTER_READERS[format];
  const dimensions = reader?.(bytes) ?? null;

  if (
    dimensions === null ||
    dimensions.widthPx <= 0 ||
    dimensions.heightPx <= 0
  ) {
    return { ok: false, reason: "unreadable" };
  }

  return { ok: true, kind: "raster", format, ...dimensions };
}
