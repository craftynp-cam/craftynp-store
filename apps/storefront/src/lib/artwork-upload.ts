import {
  ARTWORK_ACCEPT,
  ARTWORK_ACCEPTED_LABEL,
  MAX_ARTWORK_BYTES,
  artworkInspectResponseSchema,
  artworkUploadResponseSchema,
  resolveArtworkMimeType,
} from "@craftynp/types";
import type { ArtworkKind, ArtworkMimeType } from "@craftynp/types";

export type ArtworkFileMeta = {
  fileName: string;
  mimeType: ArtworkMimeType;
  sizeBytes: number;
};

export type ArtworkReference = ArtworkFileMeta & {
  uploadId: string;
  storageKey: string;
  // Measured from the stored bytes by Medusa, never from the browser, so the
  // resolution the shopper is gated on is one they cannot overstate.
  kind: ArtworkKind;
  widthPx: number | null;
  heightPx: number | null;
};

export type ArtworkUploadErrorCode =
  | "unsupported_type"
  | "empty_file"
  | "too_large"
  | "multiple_files"
  | "storage_not_configured"
  | "presign_failed"
  | "presign_network"
  | "rate_limited"
  | "invalid_request"
  | "put_network"
  | "put_rejected"
  | "inspect_failed"
  | "inspect_network"
  | "mismatched_type"
  | "unreadable"
  | "aborted";

export class ArtworkUploadError extends Error {
  readonly code: ArtworkUploadErrorCode;
  readonly retryAfterSeconds: number | null;

  constructor(
    code: ArtworkUploadErrorCode,
    retryAfterSeconds: number | null = null,
  ) {
    super(code);
    this.name = "ArtworkUploadError";
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function isArtworkUploadError(
  value: unknown,
): value is ArtworkUploadError {
  return value instanceof ArtworkUploadError;
}

export { ARTWORK_ACCEPT };

const PREVIEWABLE_MIME_TYPES: readonly string[] = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
];

export function isPreviewableArtwork(mimeType: string): boolean {
  return PREVIEWABLE_MIME_TYPES.includes(mimeType);
}

export type ArtworkFileCheck =
  | { ok: true; meta: ArtworkFileMeta }
  | { ok: false; code: "unsupported_type" | "empty_file" | "too_large" };

export function checkArtworkFile(file: File): ArtworkFileCheck {
  const mimeType = resolveArtworkMimeType(file.name, file.type);
  if (mimeType === null) {
    return { ok: false, code: "unsupported_type" };
  }
  if (file.size === 0) {
    return { ok: false, code: "empty_file" };
  }
  if (file.size > MAX_ARTWORK_BYTES) {
    return { ok: false, code: "too_large" };
  }
  return {
    ok: true,
    meta: { fileName: file.name, mimeType, sizeBytes: file.size },
  };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;

  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const rounded =
    value >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded} ${units[unitIndex]}`;
}

export const ARTWORK_SIZE_LIMIT_LABEL = formatFileSize(MAX_ARTWORK_BYTES);

const RETRYABLE_CODES: readonly ArtworkUploadErrorCode[] = [
  "storage_not_configured",
  "presign_failed",
  "presign_network",
  "rate_limited",
  "put_network",
  "put_rejected",
  "inspect_failed",
  "inspect_network",
];

export function isRetryableArtworkUpload(
  code: ArtworkUploadErrorCode,
): boolean {
  return RETRYABLE_CODES.includes(code);
}

export type ArtworkUploadMessageContext = {
  sizeBytes?: number;
  retryAfterSeconds?: number | null;
};

export function artworkUploadMessage(
  code: ArtworkUploadErrorCode,
  context: ArtworkUploadMessageContext = {},
): string {
  switch (code) {
    case "unsupported_type":
      return `That file type isn't supported. Upload a ${ARTWORK_ACCEPTED_LABEL}.`;
    case "empty_file":
      return "That file is empty. Check it and choose another.";
    case "too_large": {
      const actual =
        context.sizeBytes == null ? null : formatFileSize(context.sizeBytes);
      const limit = formatFileSize(MAX_ARTWORK_BYTES);
      return actual
        ? `That file is ${actual}. The largest we can take is ${limit} — try exporting it smaller.`
        : `That file is too large. The largest we can take is ${limit}.`;
    }
    case "multiple_files":
      return "Drop one file at a time.";
    case "storage_not_configured":
      return "Artwork uploads are temporarily unavailable. Everything else you've chosen is saved — try again in a few minutes.";
    case "presign_failed":
      return "We couldn't start the upload. Try again.";
    case "rate_limited": {
      const wait = context.retryAfterSeconds;
      return wait == null || wait <= 0
        ? "You've started a lot of uploads. Wait a moment and try again."
        : `You've started a lot of uploads. Wait ${wait} seconds and try again.`;
    }
    case "invalid_request":
      return `We couldn't accept that file. Try a different ${ARTWORK_ACCEPTED_LABEL}.`;
    case "presign_network":
      return "We couldn't reach the store. Check your connection and try again.";
    case "put_network":
      return "The upload didn't finish. Check your connection and try again.";
    case "put_rejected":
      return "The upload link expired before the file finished. Try again.";
    case "inspect_failed":
      return "We couldn't check that file. Try again.";
    case "inspect_network":
      return "We couldn't reach the store to check that file. Check your connection and try again.";
    case "mismatched_type":
      return `That file isn't the kind of file its name says it is. Export it again as a ${ARTWORK_ACCEPTED_LABEL} and re-upload.`;
    case "unreadable":
      return "We couldn't read that image — it may be damaged. Export it again and re-upload.";
    case "aborted":
      return "Upload cancelled.";
  }
}

export type ArtworkUploadProgress = {
  loaded: number;
  total: number;
  fraction: number;
};

export type PutArtworkFileRequest = {
  url: string;
  file: File;
  contentType: string;
  signal?: AbortSignal;
  onProgress?: (progress: ArtworkUploadProgress) => void;
  xhrFactory?: () => XMLHttpRequest;
};

export type PutArtworkFile = (request: PutArtworkFileRequest) => Promise<void>;

export const putArtworkFileWithXhr: PutArtworkFile = ({
  url,
  file,
  contentType,
  signal,
  onProgress,
  xhrFactory,
}) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new ArtworkUploadError("aborted"));
      return;
    }

    const xhr = (xhrFactory ?? (() => new XMLHttpRequest()))();
    const abort = () => xhr.abort();

    const settle = (outcome: () => void) => {
      signal?.removeEventListener("abort", abort);
      outcome();
    };

    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || !onProgress) return;
      onProgress({
        loaded: event.loaded,
        total: event.total,
        fraction: event.total > 0 ? event.loaded / event.total : 0,
      });
    };

    xhr.onload = () => {
      settle(() => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
          return;
        }
        reject(new ArtworkUploadError("put_rejected"));
      });
    };

    xhr.onerror = () => {
      settle(() => reject(new ArtworkUploadError("put_network")));
    };

    xhr.onabort = () => {
      settle(() => reject(new ArtworkUploadError("aborted")));
    };

    signal?.addEventListener("abort", abort);
    xhr.send(file);
  });

export type UploadArtworkOptions = {
  file: File;
  signal?: AbortSignal;
  onProgress?: (progress: ArtworkUploadProgress) => void;
  fetchImpl?: typeof fetch;
  putFile?: PutArtworkFile;
};

export type UploadArtwork = (
  options: UploadArtworkOptions,
) => Promise<ArtworkReference>;

function readRetryAfterSeconds(
  body: unknown,
  response: Response,
): number | null {
  if (body != null && typeof body === "object") {
    const value = (body as Record<string, unknown>).retryAfterSeconds;
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }

  const header = response.headers.get("retry-after");
  if (header == null) return null;

  const parsed = Number.parseInt(header, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function presignFailureCode(
  response: Response,
  body: unknown,
): ArtworkUploadErrorCode {
  if (response.status === 400) return "invalid_request";
  if (response.status === 429) return "rate_limited";

  if (response.status === 503) {
    const reason =
      body != null && typeof body === "object"
        ? (body as Record<string, unknown>).reason
        : undefined;
    if (reason === "not_configured") return "storage_not_configured";
  }

  return "presign_failed";
}

function inspectFailureCode(body: unknown): ArtworkUploadErrorCode {
  const reason =
    body != null && typeof body === "object"
      ? (body as Record<string, unknown>).reason
      : undefined;

  if (reason === "mismatched_type") return "mismatched_type";
  if (reason === "unreadable") return "unreadable";
  return "inspect_failed";
}

export const uploadArtwork: UploadArtwork = async ({
  file,
  signal,
  onProgress,
  fetchImpl,
  putFile,
}) => {
  const check = checkArtworkFile(file);
  if (!check.ok) throw new ArtworkUploadError(check.code);

  const backendUrl = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL;
  const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY;
  if (!backendUrl || !publishableKey) {
    throw new ArtworkUploadError("storage_not_configured");
  }

  const doFetch = fetchImpl ?? fetch;
  const origin = backendUrl.replace(/\/+$/, "");
  const headers = {
    "Content-Type": "application/json",
    "x-publishable-api-key": publishableKey,
  };

  let response: Response;
  try {
    response = await doFetch(`${origin}/store/artwork/uploads`, {
      method: "POST",
      headers,
      body: JSON.stringify(check.meta),
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw new ArtworkUploadError("aborted");
    if (error instanceof Error && error.name === "AbortError") {
      throw new ArtworkUploadError("aborted");
    }
    throw new ArtworkUploadError("presign_network");
  }

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const code = presignFailureCode(response, body);
    throw new ArtworkUploadError(
      code,
      code === "rate_limited" ? readRetryAfterSeconds(body, response) : null,
    );
  }

  const parsed = artworkUploadResponseSchema.safeParse(body);
  if (!parsed.success) throw new ArtworkUploadError("presign_failed");

  await (putFile ?? putArtworkFileWithXhr)({
    url: parsed.data.uploadUrl,
    file,
    contentType: parsed.data.requiredHeaders["content-type"],
    signal,
    onProgress,
  });

  // Only the stored bytes can say what the file really is and how many pixels
  // across it is. Nothing here measures it in the browser: a shopper cannot be
  // the source of the number that decides whether their order is printable.
  let inspectResponse: Response;
  try {
    inspectResponse = await doFetch(
      `${origin}/store/artwork/uploads/${encodeURIComponent(parsed.data.uploadId)}/inspect`,
      { method: "POST", headers, signal },
    );
  } catch (error) {
    if (signal?.aborted) throw new ArtworkUploadError("aborted");
    if (error instanceof Error && error.name === "AbortError") {
      throw new ArtworkUploadError("aborted");
    }
    throw new ArtworkUploadError("inspect_network");
  }

  const inspectBody: unknown = await inspectResponse.json().catch(() => null);

  if (!inspectResponse.ok) {
    throw new ArtworkUploadError(inspectFailureCode(inspectBody));
  }

  const inspected = artworkInspectResponseSchema.safeParse(inspectBody);
  if (!inspected.success) throw new ArtworkUploadError("inspect_failed");

  return {
    uploadId: parsed.data.uploadId,
    storageKey: parsed.data.storageKey,
    kind: inspected.data.kind,
    widthPx: inspected.data.widthPx,
    heightPx: inspected.data.heightPx,
    ...check.meta,
  };
};
