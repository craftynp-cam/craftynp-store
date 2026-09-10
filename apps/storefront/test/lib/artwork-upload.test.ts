import { MAX_ARTWORK_BYTES } from "@craftynp/types";

import {
  ArtworkUploadError,
  artworkUploadMessage,
  checkArtworkFile,
  formatFileSize,
  putArtworkFileWithXhr,
  uploadArtwork,
} from "@/lib/artwork-upload";
import type {
  ArtworkUploadErrorCode,
  PutArtworkFile,
} from "@/lib/artwork-upload";

const BACKEND_URL = "https://api.example.test";
const PUBLISHABLE_KEY = "pk_test";

function makeFile({
  name = "logo.png",
  type = "image/png",
  size = 2048,
}: { name?: string; type?: string; size?: number } = {}) {
  const file = new File([new Uint8Array(1)], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

const presignBody = {
  uploadId: "upload-1",
  storageKey: "staging/upload-1.png",
  uploadUrl: "https://r2.example.test/staging/upload-1.png?signature=abc",
  expiresAt: "2026-01-01T00:00:00.000Z",
  requiredHeaders: {
    "content-type": "image/png",
    "content-length": "2048",
  },
};

const inspectBody = {
  uploadId: "upload-1",
  kind: "raster" as const,
  widthPx: 1200,
  heightPx: 900,
};

// The presign and the inspect call are two requests to the backend around one
// PUT, so a fetch double has to answer both in order.
function backendFetch(...responses: Response[]) {
  const fetchImpl = jest.fn();
  for (const response of responses) fetchImpl.mockResolvedValueOnce(response);
  return fetchImpl;
}

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return error instanceof ArtworkUploadError
      ? error.code
      : "not-an-upload-error";
  }
  return "resolved";
}

describe("checkArtworkFile", () => {
  it("accepts a supported file within the size limit", () => {
    const check = checkArtworkFile(makeFile());
    expect(check).toEqual({
      ok: true,
      meta: { fileName: "logo.png", mimeType: "image/png", sizeBytes: 2048 },
    });
  });

  it("rejects a type outside the allowlist", () => {
    expect(checkArtworkFile(makeFile({ type: "text/plain" }))).toEqual({
      ok: false,
      code: "unsupported_type",
    });
  });

  it("rejects a dropped folder, which arrives with neither type nor extension", () => {
    expect(checkArtworkFile(makeFile({ name: "Designs", type: "" }))).toEqual({
      ok: false,
      code: "unsupported_type",
    });
  });

  it("rejects an empty file", () => {
    expect(checkArtworkFile(makeFile({ size: 0 }))).toEqual({
      ok: false,
      code: "empty_file",
    });
  });

  it("rejects one byte over the limit and accepts one byte under it", () => {
    expect(checkArtworkFile(makeFile({ size: MAX_ARTWORK_BYTES + 1 }))).toEqual(
      {
        ok: false,
        code: "too_large",
      },
    );
    expect(checkArtworkFile(makeFile({ size: MAX_ARTWORK_BYTES })).ok).toBe(
      true,
    );
  });
});

describe("formatFileSize", () => {
  it.each([
    [0, "0 B"],
    [999, "999 B"],
    [1024, "1 KB"],
    [1_572_864, "1.5 MB"],
    [MAX_ARTWORK_BYTES, "25 MB"],
  ])("formats %i as %s", (bytes, expected) => {
    expect(formatFileSize(bytes)).toBe(expected);
  });
});

describe("artworkUploadMessage", () => {
  it("names both the offending size and the limit", () => {
    const message = artworkUploadMessage("too_large", {
      sizeBytes: 31_457_280,
    });
    expect(message).toContain("30 MB");
    expect(message).toContain("25 MB");
  });

  it("interpolates the retry window, and omits it when unknown", () => {
    expect(
      artworkUploadMessage("rate_limited", { retryAfterSeconds: 47 }),
    ).toContain("47");
    expect(
      artworkUploadMessage("rate_limited", { retryAfterSeconds: null }),
    ).not.toMatch(/\d/);
  });
});

describe("uploadArtwork", () => {
  const originalBackendUrl = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL;
  const originalKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL = BACKEND_URL;
    process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY = PUBLISHABLE_KEY;
  });

  afterAll(() => {
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL = originalBackendUrl;
    process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY = originalKey;
  });

  it("presigns with the file's own metadata, then PUTs that same file to the returned url", async () => {
    const file = makeFile();
    const fetchImpl = backendFetch(
      jsonResponse(200, presignBody),
      jsonResponse(200, inspectBody),
    );
    const putFile = jest.fn<
      ReturnType<PutArtworkFile>,
      Parameters<PutArtworkFile>
    >(() => Promise.resolve());

    const reference = await uploadArtwork({ file, fetchImpl, putFile });

    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(`${BACKEND_URL}/store/artwork/uploads`);
    expect(init.method).toBe("POST");
    expect(init.headers["x-publishable-api-key"]).toBe(PUBLISHABLE_KEY);
    expect(JSON.parse(init.body)).toEqual({
      fileName: "logo.png",
      mimeType: "image/png",
      sizeBytes: 2048,
    });

    expect(putFile).toHaveBeenCalledTimes(1);
    const put = putFile.mock.calls[0]![0];
    expect(put.url).toBe(presignBody.uploadUrl);
    expect(put.file).toBe(file);

    expect(reference).toEqual({
      uploadId: "upload-1",
      storageKey: "staging/upload-1.png",
      fileName: "logo.png",
      mimeType: "image/png",
      sizeBytes: 2048,
      kind: "raster",
      widthPx: 1200,
      heightPx: 900,
    });
  });

  it("measures the stored file after the PUT, never in the browser", async () => {
    // The pixel count decides whether the order is printable, so it has to come
    // from the bytes in the bucket rather than from anything the shopper sends.
    const order: string[] = [];
    const fetchImpl = jest
      .fn()
      .mockImplementationOnce(() => {
        order.push("presign");
        return Promise.resolve(jsonResponse(200, presignBody));
      })
      .mockImplementationOnce(() => {
        order.push("inspect");
        return Promise.resolve(jsonResponse(200, inspectBody));
      });
    const putFile = jest.fn(() => {
      order.push("put");
      return Promise.resolve();
    });

    await uploadArtwork({ file: makeFile(), fetchImpl, putFile });

    const [inspectUrl, inspectInit] = fetchImpl.mock.calls[1]!;
    expect(inspectUrl).toBe(
      `${BACKEND_URL}/store/artwork/uploads/upload-1/inspect`,
    );
    expect(inspectInit.method).toBe("POST");
    // Inspecting before the PUT would measure an object that is not there yet.
    expect(order).toEqual(["presign", "put", "inspect"]);
  });

  it.each<[string, ArtworkUploadErrorCode]>([
    ["mismatched_type", "mismatched_type"],
    ["unreadable", "unreadable"],
  ])(
    "surfaces a rejected file as %s rather than a generic failure",
    async (reason, expected) => {
      const fetchImpl = backendFetch(
        jsonResponse(200, presignBody),
        jsonResponse(422, { error: "artwork_rejected", reason }),
      );

      expect(
        await codeOf(
          uploadArtwork({
            file: makeFile(),
            fetchImpl,
            putFile: jest.fn().mockResolvedValue(undefined),
          }),
        ),
      ).toBe(expected);
    },
  );

  it("does not hand back a reference when the file could not be measured", async () => {
    const fetchImpl = backendFetch(
      jsonResponse(200, presignBody),
      jsonResponse(200, { uploadId: "upload-1" }),
    );

    expect(
      await codeOf(
        uploadArtwork({
          file: makeFile(),
          fetchImpl,
          putFile: jest.fn().mockResolvedValue(undefined),
        }),
      ),
    ).toBe("inspect_failed");
  });

  it("sends the content type the presign response signed for, not the file's own", async () => {
    const file = makeFile();
    const fetchImpl = backendFetch(
      jsonResponse(200, {
        ...presignBody,
        requiredHeaders: {
          ...presignBody.requiredHeaders,
          "content-type": "image/jpeg",
        },
      }),
      jsonResponse(200, inspectBody),
    );
    const putFile = jest.fn().mockResolvedValue(undefined);

    await uploadArtwork({ file, fetchImpl, putFile });

    expect(putFile.mock.calls[0]![0].contentType).toBe("image/jpeg");
  });

  it.each<[number, unknown, ArtworkUploadErrorCode]>([
    [400, { error: "invalid" }, "invalid_request"],
    [403, { error: "forbidden" }, "presign_failed"],
    [502, { error: "artwork_storage_unavailable" }, "presign_failed"],
    [
      503,
      { error: "artwork_storage_unavailable", reason: "not_configured" },
      "storage_not_configured",
    ],
  ])("maps a %i presign response to %s", async (status, body, expected) => {
    const putFile = jest.fn();
    const code = await codeOf(
      uploadArtwork({
        file: makeFile(),
        fetchImpl: jest.fn().mockResolvedValue(jsonResponse(status, body)),
        putFile,
      }),
    );

    expect(code).toBe(expected);
    expect(putFile).not.toHaveBeenCalled();
  });

  it("lifts retryAfterSeconds off a 429 body", async () => {
    try {
      await uploadArtwork({
        file: makeFile(),
        fetchImpl: jest
          .fn()
          .mockResolvedValue(jsonResponse(429, { retryAfterSeconds: 47 })),
        putFile: jest.fn(),
      });
      throw new Error("expected a rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(ArtworkUploadError);
      expect((error as ArtworkUploadError).code).toBe("rate_limited");
      expect((error as ArtworkUploadError).retryAfterSeconds).toBe(47);
    }
  });

  it("falls back to the Retry-After header when the body omits the field", async () => {
    try {
      await uploadArtwork({
        file: makeFile(),
        fetchImpl: jest
          .fn()
          .mockResolvedValue(jsonResponse(429, {}, { "retry-after": "12" })),
        putFile: jest.fn(),
      });
      throw new Error("expected a rejection");
    } catch (error) {
      expect((error as ArtworkUploadError).retryAfterSeconds).toBe(12);
    }
  });

  it("does not upload when the presign call never reaches the backend", async () => {
    const putFile = jest.fn();
    const code = await codeOf(
      uploadArtwork({
        file: makeFile(),
        fetchImpl: jest
          .fn()
          .mockRejectedValue(new TypeError("failed to fetch")),
        putFile,
      }),
    );

    expect(code).toBe("presign_network");
    expect(putFile).not.toHaveBeenCalled();
  });

  it("does not upload when a 200 body is missing the upload url", async () => {
    const putFile = jest.fn();
    const { uploadUrl: _uploadUrl, ...withoutUrl } = presignBody;

    const code = await codeOf(
      uploadArtwork({
        file: makeFile(),
        fetchImpl: jest.fn().mockResolvedValue(jsonResponse(200, withoutUrl)),
        putFile,
      }),
    );

    expect(code).toBe("presign_failed");
    expect(putFile).not.toHaveBeenCalled();
  });

  it("rejects an unsupported file before spending a presign request", async () => {
    const fetchImpl = jest.fn();
    const code = await codeOf(
      uploadArtwork({ file: makeFile({ type: "text/plain" }), fetchImpl }),
    );

    expect(code).toBe("unsupported_type");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("reports an unconfigured storefront rather than calling a blank url", async () => {
    delete process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY;
    const fetchImpl = jest.fn();

    const code = await codeOf(uploadArtwork({ file: makeFile(), fetchImpl }));

    expect(code).toBe("storage_not_configured");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

type FakeXhr = {
  method: string | null;
  url: string | null;
  headers: [string, string][];
  body: unknown;
  status: number;
  upload: { onprogress: ((event: ProgressEvent) => void) | null };
  onload: (() => void) | null;
  onerror: (() => void) | null;
  onabort: (() => void) | null;
  open: (method: string, url: string) => void;
  setRequestHeader: (name: string, value: string) => void;
  send: (body: unknown) => void;
  abort: () => void;
};

function fakeXhr(): FakeXhr {
  const xhr: FakeXhr = {
    method: null,
    url: null,
    headers: [],
    body: undefined,
    status: 200,
    upload: { onprogress: null },
    onload: null,
    onerror: null,
    onabort: null,
    open(method, url) {
      xhr.method = method;
      xhr.url = url;
    },
    setRequestHeader(name, value) {
      xhr.headers.push([name, value]);
    },
    send(body) {
      xhr.body = body;
    },
    abort() {
      xhr.onabort?.();
    },
  };
  return xhr;
}

describe("putArtworkFileWithXhr", () => {
  it("sets exactly one request header, and it is Content-Type", async () => {
    const xhr = fakeXhr();
    const file = makeFile();

    const promise = putArtworkFileWithXhr({
      url: "https://r2.example.test/object",
      file,
      contentType: "image/png",
      xhrFactory: () => xhr as unknown as XMLHttpRequest,
    });

    expect(xhr.headers).toEqual([["Content-Type", "image/png"]]);
    expect(xhr.method).toBe("PUT");
    expect(xhr.body).toBe(file);

    xhr.onload?.();
    await expect(promise).resolves.toBeUndefined();
  });

  it("reports a computable progress event as a fraction", async () => {
    const xhr = fakeXhr();
    const onProgress = jest.fn();

    const promise = putArtworkFileWithXhr({
      url: "https://r2.example.test/object",
      file: makeFile(),
      contentType: "image/png",
      onProgress,
      xhrFactory: () => xhr as unknown as XMLHttpRequest,
    });

    xhr.upload.onprogress?.({
      lengthComputable: true,
      loaded: 512,
      total: 2048,
    } as ProgressEvent);
    xhr.upload.onprogress?.({
      lengthComputable: false,
      loaded: 0,
      total: 0,
    } as ProgressEvent);

    expect(onProgress).toHaveBeenCalledTimes(1);
    expect(onProgress).toHaveBeenCalledWith({
      loaded: 512,
      total: 2048,
      fraction: 0.25,
    });

    xhr.onload?.();
    await promise;
  });

  it("treats a non-2xx from the bucket as a rejected upload", async () => {
    const xhr = fakeXhr();
    xhr.status = 403;

    const promise = putArtworkFileWithXhr({
      url: "https://r2.example.test/object",
      file: makeFile(),
      contentType: "image/png",
      xhrFactory: () => xhr as unknown as XMLHttpRequest,
    });

    xhr.onload?.();
    expect(await codeOf(promise)).toBe("put_rejected");
  });

  it("distinguishes a transport failure from a rejected upload", async () => {
    const xhr = fakeXhr();

    const promise = putArtworkFileWithXhr({
      url: "https://r2.example.test/object",
      file: makeFile(),
      contentType: "image/png",
      xhrFactory: () => xhr as unknown as XMLHttpRequest,
    });

    xhr.onerror?.();
    expect(await codeOf(promise)).toBe("put_network");
  });

  it("aborts the request when the signal fires", async () => {
    const xhr = fakeXhr();
    const controller = new AbortController();

    const promise = putArtworkFileWithXhr({
      url: "https://r2.example.test/object",
      file: makeFile(),
      contentType: "image/png",
      signal: controller.signal,
      xhrFactory: () => xhr as unknown as XMLHttpRequest,
    });

    controller.abort();
    expect(await codeOf(promise)).toBe("aborted");
  });
});
