import type { Logger } from "@medusajs/framework/types";

import {
  ArtworkChangedAfterInspectError,
  copyArtwork,
  deleteArtwork,
} from "./artwork-storage";
import type ArtworkModuleService from "../modules/artwork/service";
import type { ArtworkClaimRow } from "../modules/artwork/service";
import {
  keyExtension,
  promoteArtworkClaim,
  selectSiblingSource,
  stagingStillNeeded,
} from "./promote-artwork.js";

jest.mock("./artwork-storage", () => ({
  ...jest.requireActual("./artwork-storage"),
  copyArtwork: jest.fn(),
  deleteArtwork: jest.fn(),
}));

const copy = copyArtwork as jest.MockedFunction<typeof copyArtwork>;
const remove = deleteArtwork as jest.MockedFunction<typeof deleteArtwork>;

const STAGING_KEY = "staging/up_1.png";
const INSPECTED_ETAG = '"etag-inspected"';

const ASSET: ArtworkClaimRow["asset"] = {
  id: "asset_1",
  upload_id: "up_1",
  staging_key: STAGING_KEY,
  file_name: "logo.png",
  mime_type: "image/png",
  size_bytes: 51_200,
  uploaded_at: new Date(Date.UTC(2026, 8, 10)),
  purged_at: null,
  purge_reason: null,
  width_px: 3000,
  height_px: 3000,
  inspected_at: new Date(Date.UTC(2026, 8, 10)),
  inspected_etag: INSPECTED_ETAG,
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

function bucket(objects: Record<string, string>) {
  const stored = new Map(Object.entries(objects));

  copy.mockImplementation(async (from, to, _options, condition) => {
    const etag = stored.get(from);
    if (etag === undefined) throw missing("NoSuchKey");
    if (condition?.sourceEtag != null && condition.sourceEtag !== etag) {
      throw new ArtworkChangedAfterInspectError(from);
    }
    stored.set(to, etag);
  });
  remove.mockImplementation(async (key) => {
    stored.delete(key);
  });

  return stored;
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
    markClaimPurged: jest.fn(async (id: string, reason: string) => {
      const row = rows.find((candidate) => candidate.id === id);
      if (row) Object.assign(row, { purged_at: FILED, purge_reason: reason });
    }),
  };

  return {
    rows,
    service,
    artwork: service as unknown as ArtworkModuleService,
  };
}

function logger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as unknown as Logger & { info: jest.Mock; warn: jest.Mock };
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

describe("selectSiblingSource", () => {
  it("copies from another line's filed copy once staging is gone", () => {
    expect(selectSiblingSource("claim_B", [claim(), filedSibling])).toEqual({
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
    expect(selectSiblingSource("claim_B", claims)).toEqual({
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
  it("files the bytes inspect measured when staging still carries their ETag", async () => {
    const objects = bucket({ [STAGING_KEY]: INSPECTED_ETAG });
    const { rows, artwork } = ledger([claim()]);

    const outcome = await promoteArtworkClaim(claim(), artwork, logger());

    expect(outcome).toBe("promoted");
    expect(objects.get("artwork/order_B/li_B/up_1.png")).toBe(INSPECTED_ETAG);
    expect(rows[0]?.storage_key).toBe("artwork/order_B/li_B/up_1.png");
  });

  it("refuses to file bytes swapped in after inspect, and retires every line still waiting on that upload", async () => {
    const objects = bucket({ [STAGING_KEY]: '"etag-swapped"' });
    const other = claim({
      id: "claim_C",
      order_id: "order_C",
      line_item_id: "li_C",
    });
    const { rows, service, artwork } = ledger([claim(), other]);
    const log = logger();

    const outcome = await promoteArtworkClaim(claim(), artwork, log);

    expect(outcome).toBe("changed_after_inspect");
    expect(objects.has("artwork/order_B/li_B/up_1.png")).toBe(false);
    expect(objects.has(STAGING_KEY)).toBe(true);
    expect(service.markClaimPromoted).not.toHaveBeenCalled();
    expect(rows.map((row) => row.purge_reason)).toEqual([
      "changed_after_inspect",
      "changed_after_inspect",
    ]);
    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "[artwork:changed-after-inspect] claim=claim_B asset=asset_1 order=order_B resolution=retired",
      ),
    );
    expect(log.warn).not.toHaveBeenCalledWith(
      expect.stringContaining("[artwork:promote-failed]"),
    );
  });

  it("files a line whose staging bytes changed after inspect from a sibling already filed under the check", async () => {
    const objects = bucket({
      [STAGING_KEY]: '"etag-swapped"',
      "artwork/order_A/li_A/up_1.png": INSPECTED_ETAG,
    });
    const { rows, service, artwork } = ledger([filedSibling, claim()]);
    const log = logger();

    const outcome = await promoteArtworkClaim(claim(), artwork, log);

    expect(outcome).toBe("promoted");
    expect(copy).toHaveBeenLastCalledWith(
      "artwork/order_A/li_A/up_1.png",
      "artwork/order_B/li_B/up_1.png",
    );
    expect(objects.get("artwork/order_B/li_B/up_1.png")).toBe(INSPECTED_ETAG);
    expect(rows.find((row) => row.id === "claim_B")?.storage_key).toBe(
      "artwork/order_B/li_B/up_1.png",
    );
    expect(service.markClaimPurged).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "[artwork:changed-after-inspect] claim=claim_B asset=asset_1 order=order_B resolution=sibling",
      ),
    );
  });

  it("leaves a line whose copy failed for any other reason pending, for the sweeper to retry", async () => {
    bucket({
      [STAGING_KEY]: INSPECTED_ETAG,
      "artwork/order_A/li_A/up_1.png": INSPECTED_ETAG,
    });
    copy.mockRejectedValueOnce(
      Object.assign(new Error("InternalError"), {
        name: "InternalError",
        $metadata: { httpStatusCode: 500 },
      }),
    );
    const { rows, service, artwork } = ledger([filedSibling, claim()]);

    const outcome = await promoteArtworkClaim(claim(), artwork, logger());

    expect(outcome).toBe("failed");
    expect(copy).toHaveBeenCalledTimes(1);
    expect(service.markClaimPurged).not.toHaveBeenCalled();
    expect(rows.find((row) => row.id === "claim_B")?.promoted_at).toBeNull();
  });

  it("still never throws when retiring a changed upload's lines fails, and leaves the line to the sweeper", async () => {
    bucket({ [STAGING_KEY]: '"etag-swapped"' });
    const { service, artwork } = ledger([claim()]);
    service.markClaimPurged.mockRejectedValue(new Error("connection reset"));
    const log = logger();

    await expect(promoteArtworkClaim(claim(), artwork, log)).resolves.toBe(
      "changed_after_inspect",
    );
    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining("[artwork:promote-failed] claim=claim_B"),
    );
  });

  it("files an upload inspected before ETags were recorded without holding it to one, and logs it as unbound", async () => {
    const legacy = claim({ asset: { ...ASSET, inspected_etag: null } });
    const objects = bucket({ [STAGING_KEY]: '"etag-any"' });
    const { artwork } = ledger([legacy]);
    const log = logger();

    const outcome = await promoteArtworkClaim(legacy, artwork, log);

    expect(outcome).toBe("promoted");
    expect(objects.has("artwork/order_B/li_B/up_1.png")).toBe(true);
    expect(log.info).toHaveBeenCalledWith(
      expect.stringContaining("etag=unbound"),
    );
  });

  it("copies from a filed sibling once staging is gone", async () => {
    const objects = bucket({ "artwork/order_A/li_A/up_1.png": INSPECTED_ETAG });
    const { rows, artwork } = ledger([filedSibling, claim()]);

    const outcome = await promoteArtworkClaim(claim(), artwork, logger());

    expect(outcome).toBe("promoted");
    expect(objects.has("artwork/order_B/li_B/up_1.png")).toBe(true);
    expect(rows.find((row) => row.id === "claim_B")?.storage_key).toBe(
      "artwork/order_B/li_B/up_1.png",
    );
  });

  it("removes staging only after the last line waiting on it is filed", async () => {
    const objects = bucket({ [STAGING_KEY]: INSPECTED_ETAG });
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
    const { artwork } = ledger([first, second]);

    await promoteArtworkClaim(first, artwork, logger());
    expect(objects.has(STAGING_KEY)).toBe(true);

    await promoteArtworkClaim(second, artwork, logger());
    expect(objects.has(STAGING_KEY)).toBe(false);
    expect(objects.has("artwork/order_1/li_1/up_1.png")).toBe(true);
    expect(objects.has("artwork/order_1/li_2/up_1.png")).toBe(true);
  });
});
