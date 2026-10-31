import { randomBytes } from "node:crypto";
import { Readable } from "node:stream";
import { S3Client } from "@aws-sdk/client-s3";
import type { CopyObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

import {
  ArtworkChangedAfterInspectError,
  ArtworkStorageNotConfiguredError,
  DEFAULT_SIGNED_URL_SECONDS,
  MAX_SIGNED_URL_SECONDS,
  MIN_SIGNED_URL_SECONDS,
  UnsafeArtworkKeyPartError,
  __resetForTests,
  artworkObjectKey,
  clampExpiry,
  contentDisposition,
  copyArtwork,
  isMissingObject,
  readArtworkHead,
  readArtworkStorageOptions,
  readUploadUrlTtlSeconds,
  stagingObjectKey,
} from "./artwork-storage.js";

jest.mock("@aws-sdk/client-s3", () => ({
  ...jest.requireActual("@aws-sdk/client-s3"),
  S3Client: jest.fn(),
}));

const MIB = 1024 * 1024;

const COMPLETE = {
  ARTWORK_STORAGE_ENDPOINT: "http://localhost:9002",
  ARTWORK_STORAGE_BUCKET: "craftynp-artwork",
  ARTWORK_STORAGE_ACCESS_KEY_ID: "craftynp",
  ARTWORK_STORAGE_SECRET_ACCESS_KEY: "craftynp-local-secret",
} as NodeJS.ProcessEnv;

const s3Error = (name: string, httpStatusCode: number) =>
  Object.assign(new Error(name), { name, $metadata: { httpStatusCode } });

describe("readArtworkStorageOptions", () => {
  it("defaults the region to auto, which is what R2 expects", () => {
    expect(readArtworkStorageOptions(COMPLETE).region).toBe("auto");
  });

  it("keeps path-style addressing on unless it is turned off by the literal false", () => {
    expect(
      readArtworkStorageOptions({
        ...COMPLETE,
        ARTWORK_STORAGE_FORCE_PATH_STYLE: "no",
      }).forcePathStyle,
    ).toBe(true);
    expect(
      readArtworkStorageOptions({
        ...COMPLETE,
        ARTWORK_STORAGE_FORCE_PATH_STYLE: "false",
      }).forcePathStyle,
    ).toBe(false);
  });

  it.each([
    "ARTWORK_STORAGE_ENDPOINT",
    "ARTWORK_STORAGE_BUCKET",
    "ARTWORK_STORAGE_ACCESS_KEY_ID",
    "ARTWORK_STORAGE_SECRET_ACCESS_KEY",
  ])("refuses to run without %s", (key) => {
    const env = { ...COMPLETE };
    delete env[key];

    expect(() => readArtworkStorageOptions(env)).toThrow(
      ArtworkStorageNotConfiguredError,
    );
  });

  it("names what is missing, so the failure is actionable", () => {
    const env = { ...COMPLETE };
    delete env.ARTWORK_STORAGE_BUCKET;

    expect(() => readArtworkStorageOptions(env)).toThrow(/bucket/);
  });
});

describe("stagingObjectKey", () => {
  it("puts an upload under the staging prefix the lifecycle rule expires", () => {
    expect(stagingObjectKey("01JX", "png")).toBe("staging/01JX.png");
  });
});

describe("artworkObjectKey", () => {
  it("traces the object back to its order and line item", () => {
    expect(artworkObjectKey("order_01", "li_02", "01JX", "pdf")).toBe(
      "artwork/order_01/li_02/01JX.pdf",
    );
  });

  it.each([
    ["a slash", "order_01/../order_02"],
    ["a traversal", ".."],
    ["a leading dot", ".hidden"],
    ["an empty string", ""],
  ])(
    "refuses an order id containing %s, which would reach another order's prefix",
    (_label, orderId) => {
      expect(() => artworkObjectKey(orderId, "li_02", "01JX", "png")).toThrow(
        UnsafeArtworkKeyPartError,
      );
    },
  );
});

describe("clampExpiry", () => {
  it("holds a signed URL to the bounded window, however it is asked", () => {
    expect(clampExpiry(10)).toBe(MIN_SIGNED_URL_SECONDS);
    expect(clampExpiry(86_400)).toBe(MAX_SIGNED_URL_SECONDS);
    expect(clampExpiry(300)).toBe(300);
  });

  it("falls back to the default rather than signing NaN", () => {
    expect(clampExpiry(Number.NaN)).toBe(DEFAULT_SIGNED_URL_SECONDS);
  });
});

describe("readUploadUrlTtlSeconds", () => {
  it("ignores a typo rather than signing a URL nobody can use", () => {
    expect(
      readUploadUrlTtlSeconds({ ARTWORK_UPLOAD_URL_TTL_SECONDS: "soon" }),
    ).toBe(DEFAULT_SIGNED_URL_SECONDS);
  });

  it("reads a configured value", () => {
    expect(
      readUploadUrlTtlSeconds({ ARTWORK_UPLOAD_URL_TTL_SECONDS: "600" }),
    ).toBe(600);
  });
});

describe("readArtworkHead", () => {
  const send = jest.fn<Promise<unknown>, [GetObjectCommand]>();

  function storedBody(object: Buffer, chunkSize = 1_000_000) {
    const served = { bytes: 0 };

    function* chunks() {
      for (let offset = 0; offset < object.length; offset += chunkSize) {
        const chunk = object.subarray(offset, offset + chunkSize);
        served.bytes += chunk.length;
        yield chunk;
      }
    }

    return Object.assign(Readable.from(chunks()), {
      served,
      transformToByteArray: async () => {
        served.bytes = object.length;
        return new Uint8Array(object);
      },
    });
  }

  beforeEach(() => {
    __resetForTests();
    send.mockReset();
    (S3Client as unknown as jest.Mock).mockImplementation(() => ({ send }));
  });

  it("never holds more than 4 MiB of a 25 MB object, even when storage ignores the Range", async () => {
    const object = randomBytes(25 * MIB);
    const body = storedBody(object);
    send.mockResolvedValue({ Body: body, ContentLength: object.length });

    const head = await readArtworkHead(
      "staging/upl_1.jpg",
      object.length,
      readArtworkStorageOptions(COMPLETE),
    );

    expect(send.mock.calls[0]?.[0].input.Range).toBe("bytes=0-4194303");
    expect(head.bytes.length).toBe(4 * MIB);
    expect(Buffer.from(head.bytes).equals(object.subarray(0, 4 * MIB))).toBe(
      true,
    );
    expect(body.destroyed).toBe(true);
    expect(body.readableEnded).toBe(false);
    expect(body.served.bytes).toBeLessThanOrEqual(4 * MIB + 1_000_000);
  });

  it.each([
    ["a ranged response", 64 * 1024],
    ["a chunked response", undefined],
  ])(
    "reads %s that ends exactly at the requested length to its end, so its connection can be reused",
    async (_label, contentLength) => {
      const object = randomBytes(64 * 1024);
      const body = storedBody(object, 16 * 1024);
      send.mockResolvedValue({ Body: body, ContentLength: contentLength });

      const head = await readArtworkHead(
        "staging/upl_1.jpg",
        object.length,
        readArtworkStorageOptions(COMPLETE),
      );

      expect(Buffer.from(head.bytes).equals(object)).toBe(true);
      expect(body.readableEnded).toBe(true);
    },
  );

  it("reports the ETag of the response its bytes came from, and holds a read to an ETag it is given", async () => {
    const object = randomBytes(1024);
    send.mockResolvedValue({ Body: storedBody(object), ETag: '"etag-1"' });

    const head = await readArtworkHead(
      "staging/upl_1.jpg",
      object.length,
      readArtworkStorageOptions(COMPLETE),
      { ifMatch: '"etag-1"' },
    );

    expect(send.mock.calls[0]?.[0].input.IfMatch).toBe('"etag-1"');
    expect(head.etag).toBe('"etag-1"');
  });
});

describe("copyArtwork", () => {
  const send = jest.fn<Promise<unknown>, [CopyObjectCommand]>();
  const FROM = "staging/upl_1.png";
  const TO = "artwork/order_1/li_1/upl_1.png";

  beforeEach(() => {
    __resetForTests();
    send.mockReset();
    (S3Client as unknown as jest.Mock).mockImplementation(() => ({ send }));
  });

  it("copies only while the source still carries the ETag inspect recorded", async () => {
    send.mockResolvedValue({});

    await copyArtwork(FROM, TO, readArtworkStorageOptions(COMPLETE), {
      sourceEtag: '"etag-1"',
    });

    expect(send.mock.calls[0]?.[0].input.CopySourceIfMatch).toBe('"etag-1"');
  });

  it("copies an upload inspected before ETags were recorded without a condition", async () => {
    send.mockResolvedValue({});

    await copyArtwork(FROM, TO, readArtworkStorageOptions(COMPLETE), {
      sourceEtag: null,
    });

    expect(send.mock.calls[0]?.[0].input.CopySourceIfMatch).toBeUndefined();
  });

  it.each([
    [
      "the PreconditionFailed MinIO answers",
      s3Error("PreconditionFailed", 412),
    ],
    ["a 412 under any other name", s3Error("Unknown", 412)],
  ])(
    "reports %s as the upload having changed after inspect",
    async (_label, error) => {
      send.mockRejectedValue(error);

      await expect(
        copyArtwork(FROM, TO, readArtworkStorageOptions(COMPLETE), {
          sourceEtag: '"etag-1"',
        }),
      ).rejects.toBeInstanceOf(ArtworkChangedAfterInspectError);
    },
  );

  it("passes a missing source through unchanged, so promotion can still fall back to a filed copy", async () => {
    const error = s3Error("NoSuchKey", 404);
    send.mockRejectedValue(error);

    await expect(
      copyArtwork(FROM, TO, readArtworkStorageOptions(COMPLETE), {
        sourceEtag: '"etag-1"',
      }),
    ).rejects.toBe(error);
  });
});

describe("contentDisposition", () => {
  it("keeps a quote out of the header while preserving the real name for the browser", () => {
    const header = contentDisposition('my "art".png');

    expect(header).toContain('filename="my _art_.png"');
    expect(header).toContain("filename*=UTF-8''my%20%22art%22.png");
  });

  it("escapes an apostrophe, which would otherwise close the ext-value early", () => {
    expect(contentDisposition("Kid's drawing.png")).toContain(
      "filename*=UTF-8''Kid%27s%20drawing.png",
    );
  });
});

describe("isMissingObject", () => {
  it.each([
    ["a HEAD of a missing key", s3Error("NotFound", 404)],
    ["a copy from a missing key", s3Error("NoSuchKey", 404)],
  ])("reads %s as missing", (_label, error) => {
    expect(isMissingObject(error)).toBe(true);
  });

  it.each([
    ["a storage outage", s3Error("InternalError", 500)],
    ["refused credentials", s3Error("AccessDenied", 403)],
    ["a dropped connection", new Error("socket hang up")],
    ["a non-error rejection", "timeout"],
  ])(
    "does not read %s as missing, so a transient failure never abandons a paid line",
    (_label, error) => {
      expect(isMissingObject(error)).toBe(false);
    },
  );
});
