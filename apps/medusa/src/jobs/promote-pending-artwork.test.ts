import type { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

import {
  copyArtwork,
  deleteArtwork,
  headArtwork,
} from "../lib/artwork-storage";
import { STAGING_WINDOW_DAYS } from "../lib/artwork-retention";
import type { ArtworkClaimRow } from "../modules/artwork/service";
import { promotePendingArtwork } from "./promote-pending-artwork.js";

jest.mock("../lib/artwork-storage", () => ({
  ...jest.requireActual("../lib/artwork-storage"),
  headArtwork: jest.fn(),
  copyArtwork: jest.fn(),
  deleteArtwork: jest.fn(),
}));

const head = headArtwork as jest.MockedFunction<typeof headArtwork>;
const copy = copyArtwork as jest.MockedFunction<typeof copyArtwork>;
const remove = deleteArtwork as jest.MockedFunction<typeof deleteArtwork>;

const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS);

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

function claims(uploadedDaysAgo: number, withFiledSibling: boolean) {
  const asset: ArtworkClaimRow["asset"] = {
    id: "asset_1",
    upload_id: "up_1",
    staging_key: "staging/up_1.png",
    file_name: "logo.png",
    mime_type: "image/png",
    size_bytes: 51_200,
    uploaded_at: daysAgo(uploadedDaysAgo),
    purged_at: null,
    purge_reason: null,
    width_px: 3000,
    height_px: 3000,
    inspected_at: daysAgo(uploadedDaysAgo),
    inspected_etag: '"etag-1"',
  };

  const pending: ArtworkClaimRow = {
    id: "claim_B",
    asset_id: "asset_1",
    order_id: "order_B",
    line_item_id: "li_B",
    storage_key: null,
    promoted_at: null,
    purged_at: null,
    purge_reason: null,
    asset,
  };

  const sibling: ArtworkClaimRow = {
    ...pending,
    id: "claim_A",
    order_id: "order_A",
    line_item_id: "li_A",
    storage_key: "artwork/order_A/li_A/up_1.png",
    promoted_at: daysAgo(uploadedDaysAgo - 1),
  };

  return withFiledSibling ? [sibling, pending] : [pending];
}

function harness(rows: ArtworkClaimRow[]) {
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const service = {
    listPendingClaims: jest.fn(async () =>
      rows.filter((row) => row.promoted_at === null).map((row) => ({ ...row })),
    ),
    listClaimsForAsset: jest.fn(async () => rows.map((row) => ({ ...row }))),
    markClaimPromoted: jest.fn(async (id: string, storageKey: string) => {
      const row = rows.find((candidate) => candidate.id === id);
      if (row)
        Object.assign(row, {
          storage_key: storageKey,
          promoted_at: new Date(),
        });
    }),
    markClaimPurged: jest.fn().mockResolvedValue(undefined),
    listAbandonedUploads: jest.fn().mockResolvedValue([]),
    markPurged: jest.fn().mockResolvedValue(undefined),
  };

  const container = {
    resolve: (key: string) =>
      key === ContainerRegistrationKeys.LOGGER
        ? logger
        : key === "artwork"
          ? service
          : undefined,
  } as unknown as MedusaContainer;

  return { container, service, logger };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("promotePendingArtwork", () => {
  it("files a claim past the staging window from a sibling's copy rather than giving it up", async () => {
    const objects = bucket(["artwork/order_A/li_A/up_1.png"]);
    const { container, service } = harness(
      claims(STAGING_WINDOW_DAYS + 1, true),
    );

    await promotePendingArtwork(container);

    expect(objects.has("artwork/order_B/li_B/up_1.png")).toBe(true);
    expect(service.markClaimPurged).not.toHaveBeenCalled();
  });

  it("gives up once on a claim past the staging window with nothing left to copy from", async () => {
    bucket([]);
    const { container, service, logger } = harness(
      claims(STAGING_WINDOW_DAYS + 1, false),
    );

    await promotePendingArtwork(container);

    expect(service.markClaimPurged).toHaveBeenCalledWith(
      "claim_B",
      "staging_expired",
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("[artwork:promote-abandoned] claim=claim_B"),
    );
  });

  it("keeps retrying a claim inside the staging window that has nothing to copy from yet", async () => {
    bucket([]);
    const { container, service } = harness(claims(2, false));

    await promotePendingArtwork(container);

    expect(service.markClaimPurged).not.toHaveBeenCalled();
  });
});
