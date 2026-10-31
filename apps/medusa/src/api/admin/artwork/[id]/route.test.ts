import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

import { presignArtworkDownload } from "../../../../lib/artwork-storage";
import type { ArtworkClaimRow } from "../../../../modules/artwork/service";
import { GET } from "./route";

jest.mock("../../../../lib/artwork-storage", () => ({
  ...jest.requireActual("../../../../lib/artwork-storage"),
  presignArtworkDownload: jest.fn(),
}));

const presign = presignArtworkDownload as jest.MockedFunction<
  typeof presignArtworkDownload
>;

const FILED = new Date(Date.UTC(2026, 8, 11, 12));

function claim(overrides: Partial<ArtworkClaimRow> = {}): ArtworkClaimRow {
  return {
    id: "claim_2",
    asset_id: "asset_1",
    order_id: "order_1",
    line_item_id: "li_2",
    storage_key: "artwork/order_1/li_2/up_1.png",
    promoted_at: FILED,
    purged_at: null,
    purge_reason: null,
    asset: {
      id: "asset_1",
      upload_id: "up_1",
      staging_key: "staging/up_1.png",
      file_name: "logo.png",
      mime_type: "image/png",
      size_bytes: 51_200,
      uploaded_at: FILED,
      purged_at: null,
      purge_reason: null,
      width_px: 3000,
      height_px: 3000,
      inspected_at: FILED,
      inspected_etag: '"etag-1"',
    },
    ...overrides,
  };
}

function harness(row: ArtworkClaimRow | null) {
  const findClaim = jest.fn(async () => row);
  const json = jest.fn();
  const req = {
    params: { id: "claim_2" },
    scope: {
      resolve: (key: string) =>
        key === "artwork" ? { findClaim } : { error: jest.fn() },
    },
  } as unknown as MedusaRequest;
  const res = {
    setHeader: jest.fn(),
    status: jest.fn().mockReturnValue({ json }),
  } as unknown as MedusaResponse;

  return { req, res, json, status: res.status as jest.Mock, findClaim };
}

beforeEach(() => {
  jest.clearAllMocks();
  presign.mockResolvedValue("https://artwork.example.test/signed");
});

describe("GET /admin/artwork/:id", () => {
  it("signs the line's own filed copy under the name the file was uploaded with", async () => {
    const { req, res, status, findClaim } = harness(claim());

    await GET(req, res);

    expect(findClaim).toHaveBeenCalledWith("claim_2");
    expect(status).toHaveBeenCalledWith(200);
    expect(presign.mock.calls[0]?.[0]).toMatchObject({
      key: "artwork/order_1/li_2/up_1.png",
      fileName: "logo.png",
    });
  });

  it.each([
    ["an id with no claim", null, /No stored artwork/],
    [
      "a line still waiting for its copy",
      claim({ storage_key: null, promoted_at: null }),
      /still being filed/,
    ],
    [
      "a line whose upload expired before it was filed",
      claim({
        storage_key: null,
        promoted_at: null,
        purged_at: FILED,
        purge_reason: "staging_expired",
      }),
      /never filed/,
    ],
    [
      "a line deleted after its retention window",
      claim({ purged_at: FILED, purge_reason: "delivered" }),
      /retention window/,
    ],
  ])("answers 404 for %s, saying why", async (_label, row, message) => {
    const { req, res, json, status } = harness(row);

    await GET(req, res);

    expect(status).toHaveBeenCalledWith(404);
    expect(json.mock.calls[0]?.[0]?.message).toMatch(message);
    expect(presign).not.toHaveBeenCalled();
  });
});
