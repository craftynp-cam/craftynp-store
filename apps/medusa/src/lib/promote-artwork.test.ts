import type { Logger } from "@medusajs/framework/types";

import { copyArtwork, deleteArtwork, headArtwork } from "./artwork-storage";
import type ArtworkModuleService from "../modules/artwork/service";
import type { ArtworkClaimRow } from "../modules/artwork/service";
import {
  keyExtension,
  promoteArtworkClaim,
  selectPromotionSource,
  stagingStillNeeded,
} from "./promote-artwork.js";

jest.mock("./artwork-storage", () => ({
  ...jest.requireActual("./artwork-storage"),
  headArtwork: jest.fn(),
  copyArtwork: jest.fn(),
  deleteArtwork: jest.fn(),
}));

const head = headArtwork as jest.MockedFunction<typeof headArtwork>;
const copy = copyArtwork as jest.MockedFunction<typeof copyArtwork>;
const remove = deleteArtwork as jest.MockedFunction<typeof deleteArtwork>;

const ASSET: ArtworkClaimRow["asset"] = {
  id: "asset_1",
  upload_id: "up_1",
  staging_key: "staging/up_1.png",
  file_name: "logo.png",
  mime_type: "image/png",
  size_bytes: 51_200,
  uploaded_at: new Date(Date.UTC(2026, 8, 10)),
  purged_at: null,
  purge_reason: null,
  width_px: 3000,
  height_px: 3000,
  inspected_at: new Date(Date.UTC(2026, 8, 10)),
};

const FILED = new Date(Date.UTC(2026, 8, 11));

function claim(overrides: Partial<ArtworkClaimRow> = {}): ArtworkClaimRow {
  return {
    id: "claim_B",
    asset_id: "asset_1",
    order_id: "order_B",
    line_item_id: "li_B",
    storage_key: null,
    promoted_at: null,
    purged_at: null,
    purge_reason: null,
    asset: ASSET,
    ...overrides,
  };
}

const filedSibling = claim({
  id: "claim_A",
  order_id: "order_A",
  line_item_id: "li_A",
  storage_key: "artwork/order_A/li_A/up_1.png",
  promoted_at: FILED,
});

const missing = (name: string) =>
  Object.assign(new Error(name), { name, $metadata: { httpStatusCode: 404 } });

function bucket(keys: string[]) {
  const objects = new Set(keys);

  head.mockImplementation(async (key) => {
    if (!objects.has(key)) throw missing("NotFound");
    return { sizeBytes: 51_200 };
  });
  copy.mockImplementation(async (from, to) => {
    if (!objects.has(from)) throw missing("NoSuchKey");
    objects.add(to);
  });
  remove.mockImplementation(async (key) => {
    objects.delete(key);
  });

  return objects;
}

function ledger(seed: ArtworkClaimRow[]) {
  const rows = seed.map((row) => ({ ...row }));
  const service = {
    listClaimsForAsset: jest.fn(async (assetId: string) =>
      rows.filter((row) => row.asset_id === assetId).map((row) => ({ ...row })),
    ),
    markClaimPromoted: jest.fn(async (id: string, storageKey: string) => {
      const row = rows.find((candidate) => candidate.id === id);
      if (row)
        Object.assign(row, { storage_key: storageKey, promoted_at: FILED });
    }),
  };

  return { rows, service: service as unknown as ArtworkModuleService };
}

function logger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as unknown as Logger & { warn: jest.Mock };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("keyExtension", () => {
  it("carries the staging key's extension onto the promoted key", () => {
    expect(keyExtension("staging/01JX.png")).toBe("png");
  });

  it("falls back rather than producing a key ending in a bare dot", () => {
    expect(keyExtension("staging/01JX")).toBe("bin");
  });
});

describe("selectPromotionSource", () => {
  const target = (stagingExists: boolean) => ({
    claimId: "claim_B",
    stagingKey: "staging/up_1.png",
    stagingExists,
  });

  it("copies from staging while the staging object is still there", () => {
    expect(selectPromotionSource(target(true), [filedSibling])).toEqual({
      kind: "staging",
      key: "staging/up_1.png",
    });
  });

  it("copies from another line's filed copy once staging is gone", () => {
    expect(
      selectPromotionSource(target(false), [claim(), filedSibling]),
    ).toEqual({
      kind: "sibling",
      key: "artwork/order_A/li_A/up_1.png",
      claimId: "claim_A",
    });
  });

  it.each([
    [
      "a sibling whose copy was already purged",
      [
        claim(),
        { ...filedSibling, purged_at: FILED, purge_reason: "delivered" },
      ],
    ],
    [
      "a sibling that is still waiting for its own copy",
      [claim(), { ...filedSibling, storage_key: null, promoted_at: null }],
    ],
    ["no other line at all", [claim()]],
  ])("finds nothing to copy from with %s", (_label, claims) => {
    expect(selectPromotionSource(target(false), claims)).toEqual({
      kind: "missing",
    });
  });
});

describe("stagingStillNeeded", () => {
  it("keeps staging while another line on the upload is still waiting for its copy", () => {
    expect(stagingStillNeeded([filedSibling, claim()])).toBe(true);
  });

  it("releases staging once every line is filed or given up on", () => {
    expect(
      stagingStillNeeded([
        filedSibling,
        claim({ purged_at: FILED, purge_reason: "staging_expired" }),
      ]),
    ).toBe(false);
  });
});

describe("promoteArtworkClaim", () => {
  it("copies from a filed sibling when staging disappears between the check and the copy", async () => {
    const objects = bucket(["artwork/order_A/li_A/up_1.png"]);
    head.mockResolvedValueOnce({ sizeBytes: 51_200 });
    const { rows, service } = ledger([filedSibling, claim()]);

    const outcome = await promoteArtworkClaim(claim(), service, logger());

    expect(outcome).toBe("promoted");
    expect(objects.has("artwork/order_B/li_B/up_1.png")).toBe(true);
    expect(rows.find((row) => row.id === "claim_B")?.storage_key).toBe(
      "artwork/order_B/li_B/up_1.png",
    );
  });

  it("treats a storage outage while checking staging as a failure to retry, not as a missing file", async () => {
    bucket(["artwork/order_A/li_A/up_1.png"]);
    head.mockRejectedValueOnce(
      Object.assign(new Error("InternalError"), {
        name: "InternalError",
        $metadata: { httpStatusCode: 500 },
      }),
    );
    const { service } = ledger([filedSibling, claim()]);

    const outcome = await promoteArtworkClaim(claim(), service, logger());

    expect(outcome).toBe("failed");
    expect(copy).not.toHaveBeenCalled();
  });

  it("removes staging only after the last line waiting on it is filed", async () => {
    const objects = bucket(["staging/up_1.png"]);
    const first = claim({
      id: "claim_1",
      order_id: "order_1",
      line_item_id: "li_1",
    });
    const second = claim({
      id: "claim_2",
      order_id: "order_1",
      line_item_id: "li_2",
    });
    const { service } = ledger([first, second]);

    await promoteArtworkClaim(first, service, logger());
    expect(objects.has("staging/up_1.png")).toBe(true);

    await promoteArtworkClaim(second, service, logger());
    expect(objects.has("staging/up_1.png")).toBe(false);
    expect(objects.has("artwork/order_1/li_1/up_1.png")).toBe(true);
    expect(objects.has("artwork/order_1/li_2/up_1.png")).toBe(true);
  });
});
