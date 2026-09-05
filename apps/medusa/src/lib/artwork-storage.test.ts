import {
  ArtworkStorageNotConfiguredError,
  DEFAULT_SIGNED_URL_SECONDS,
  MAX_SIGNED_URL_SECONDS,
  MIN_SIGNED_URL_SECONDS,
  UnsafeArtworkKeyPartError,
  artworkObjectKey,
  clampExpiry,
  contentDisposition,
  readArtworkStorageOptions,
  readUploadUrlTtlSeconds,
  stagingObjectKey,
} from "./artwork-storage.js";

const COMPLETE = {
  ARTWORK_STORAGE_ENDPOINT: "http://localhost:9002",
  ARTWORK_STORAGE_BUCKET: "craftynp-artwork",
  ARTWORK_STORAGE_ACCESS_KEY_ID: "craftynp",
  ARTWORK_STORAGE_SECRET_ACCESS_KEY: "craftynp-local-secret",
} as NodeJS.ProcessEnv;

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

describe("contentDisposition", () => {
  it("keeps a quote out of the header while preserving the real name for the browser", () => {
    const header = contentDisposition('my "art".png');

    expect(header).toContain('filename="my _art_.png"');
    expect(header).toContain("filename*=UTF-8''my%20%22art%22.png");
  });
});
