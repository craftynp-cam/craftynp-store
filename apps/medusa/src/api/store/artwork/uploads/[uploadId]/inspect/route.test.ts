import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

import {
  ArtworkStorageNotConfiguredError,
  readArtworkHead,
  readArtworkStorageOptions,
} from "../../../../../../lib/artwork-storage";
import { POST } from "./route";

jest.mock("../../../../../../lib/artwork-storage", () => {
  const actual = jest.requireActual("../../../../../../lib/artwork-storage");
  return {
    ...actual,
    readArtworkHead: jest.fn(),
    readArtworkStorageOptions: jest.fn(),
  };
});

const readHead = readArtworkHead as jest.MockedFunction<typeof readArtworkHead>;
const readOptions = readArtworkStorageOptions as jest.MockedFunction<
  typeof readArtworkStorageOptions
>;

const PNG_7X3 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAcAAAADCAIAAADQoYKSAAAAAXNSR0IArs4c6QAAABRJREFUCB1j/MeABTBhEWNgwC4KAEGGAQQ4JNbqAAAAAElFTkSuQmCC",
  "base64",
);

const STORAGE_OPTIONS = {
  endpoint: "https://example.test",
  region: "auto",
  bucket: "artwork",
  accessKeyId: "key",
  secretAccessKey: "secret",
  forcePathStyle: true,
};

function asset(overrides: Record<string, unknown> = {}) {
  return {
    id: "asset_1",
    upload_id: "upl_1",
    staging_key: "staging/upl_1.png",
    storage_key: null,
    order_id: null,
    line_item_id: null,
    file_name: "logo.png",
    mime_type: "image/png",
    size_bytes: 1024,
    uploaded_at: new Date(),
    promoted_at: null,
    purged_at: null,
    purge_reason: null,
    width_px: null,
    height_px: null,
    ...overrides,
  };
}

function harness(row: ReturnType<typeof asset> | null) {
  const recordDimensions = jest.fn().mockResolvedValue(undefined);
  const service = {
    findByUploadId: jest.fn().mockResolvedValue(row),
    recordDimensions,
  };

  const req = {
    params: { uploadId: "upl_1" },
    scope: {
      resolve: (key: string) =>
        key === "artwork" ? service : { error: jest.fn(), info: jest.fn() },
    },
  } as unknown as MedusaRequest;

  const json = jest.fn();
  const res = {
    status: jest.fn().mockReturnValue({ json }),
  } as unknown as MedusaResponse;

  return { req, res, json, status: res.status as jest.Mock, recordDimensions };
}

beforeEach(() => {
  jest.clearAllMocks();
  readOptions.mockReturnValue(STORAGE_OPTIONS);
  readHead.mockResolvedValue(new Uint8Array(PNG_7X3));
});

describe("POST /store/artwork/uploads/:uploadId/inspect", () => {
  it("measures the stored bytes and records them against the upload", async () => {
    const { req, res, json, status, recordDimensions } = harness(asset());

    await POST(req, res);

    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({
      uploadId: "upl_1",
      kind: "raster",
      widthPx: 7,
      heightPx: 3,
    });
    expect(recordDimensions).toHaveBeenCalledWith("asset_1", {
      widthPx: 7,
      heightPx: 3,
    });
  });

  it("reads only the head of the object, not a 25 MB print file", () => {
    const { req, res } = harness(asset());

    return POST(req, res).then(() => {
      const [, byteCount] = readHead.mock.calls[0] ?? [];
      expect(byteCount).toBeLessThanOrEqual(1024 * 1024);
    });
  });

  it("rejects a file whose bytes contradict the type it was presigned as", async () => {
    // The presigned PUT cannot bind Content-Type, so a shopper could store a
    // text file under a .png key. This is where that is caught.
    readHead.mockResolvedValue(new Uint8Array(Buffer.from("hello", "utf8")));
    const { req, res, json, status, recordDimensions } = harness(asset());

    await POST(req, res);

    expect(status).toHaveBeenCalledWith(422);
    expect(json.mock.calls[0]?.[0]).toMatchObject({
      error: "artwork_rejected",
      reason: "mismatched_type",
    });
    expect(recordDimensions).not.toHaveBeenCalled();
  });

  it("re-reads the whole object when the head stopped short of the size", async () => {
    // A JPEG's colour profile can push its frame marker past the head we read.
    // Rejecting a good file is the worst way for this gate to fail.
    const deepHeader = new Uint8Array(
      Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(64, 0)]),
    );
    readHead
      .mockResolvedValueOnce(deepHeader)
      .mockResolvedValueOnce(new Uint8Array(PNG_7X3));

    const { req, res, status, json, recordDimensions } = harness(
      asset({ mime_type: "image/jpeg", size_bytes: 400_000 }),
    );

    await POST(req, res);

    expect(readHead).toHaveBeenCalledTimes(2);
    // The second read is bounded by the object's own size, not left open.
    expect(readHead.mock.calls[1]?.[1]).toBe(400_000);
    expect(status).toHaveBeenCalledWith(422);
    expect(json.mock.calls[0]?.[0]).toMatchObject({
      reason: "mismatched_type",
    });
    expect(recordDimensions).not.toHaveBeenCalled();
  });

  it("does not re-read when the head already held the whole object", async () => {
    readHead.mockResolvedValue(new Uint8Array(Buffer.from("hello", "utf8")));
    const { req, res } = harness(asset({ size_bytes: 5 }));

    await POST(req, res);

    expect(readHead).toHaveBeenCalledTimes(1);
  });

  it("does not re-read for a wrong signature, which more bytes cannot fix", async () => {
    readHead.mockResolvedValue(new Uint8Array(Buffer.from("not a picture")));
    const { req, res } = harness(asset({ size_bytes: 5_000_000 }));

    await POST(req, res);

    expect(readHead).toHaveBeenCalledTimes(1);
  });

  it("answers 404 for an upload it has no row for", async () => {
    const { req, res, status } = harness(null);

    await POST(req, res);

    expect(status).toHaveBeenCalledWith(404);
    expect(readHead).not.toHaveBeenCalled();
  });

  it.each([
    ["already promoted onto an order", { promoted_at: new Date() }],
    ["already purged", { purged_at: new Date() }],
  ])("answers 404 for an upload %s", async (_label, overrides) => {
    // Either way the staging object is gone, so there is nothing to read.
    const { req, res, status } = harness(asset(overrides));

    await POST(req, res);

    expect(status).toHaveBeenCalledWith(404);
    expect(readHead).not.toHaveBeenCalled();
  });

  it("answers 503 when artwork storage is not configured", async () => {
    readOptions.mockImplementation(() => {
      throw new ArtworkStorageNotConfiguredError(["ARTWORK_STORAGE_BUCKET"]);
    });
    const { req, res, json, status } = harness(asset());

    await POST(req, res);

    expect(status).toHaveBeenCalledWith(503);
    expect(json.mock.calls[0]?.[0]).toMatchObject({ reason: "not_configured" });
  });

  it("answers 502 when the bucket read fails, rather than passing the file", async () => {
    readHead.mockRejectedValue(new Error("connection reset"));
    const { req, res, status, recordDimensions } = harness(asset());

    await POST(req, res);

    expect(status).toHaveBeenCalledWith(502);
    expect(recordDimensions).not.toHaveBeenCalled();
  });
});
