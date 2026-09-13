import type { SubscriberArgs } from "@medusajs/framework";
import type { Logger } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

import {
  copyArtwork,
  deleteArtwork,
  headArtwork,
} from "../lib/artwork-storage";
import type { ArtworkClaimRow } from "../modules/artwork/service";
import promoteArtworkHandler, {
  artworkKeyOnLineItem,
} from "./promote-artwork.js";

jest.mock("../lib/artwork-storage", () => ({
  ...jest.requireActual("../lib/artwork-storage"),
  headArtwork: jest.fn(),
  copyArtwork: jest.fn(),
  deleteArtwork: jest.fn(),
}));

const head = headArtwork as jest.MockedFunction<typeof headArtwork>;
const copy = copyArtwork as jest.MockedFunction<typeof copyArtwork>;
const remove = deleteArtwork as jest.MockedFunction<typeof deleteArtwork>;

describe("artworkKeyOnLineItem", () => {
  it("reads the staging key a configured line item carries", () => {
    expect(
      artworkKeyOnLineItem({
        id: "li_1",
        metadata: {
          customization: { artwork: { storageKey: "staging/01JX.png" } },
        },
      }),
    ).toBe("staging/01JX.png");
  });

  it.each([
    ["a ready-made item with no metadata", { id: "li_1", metadata: null }],
    ["an item with no customization", { id: "li_1", metadata: { note: "hi" } }],
    [
      "a customization with no artwork",
      {
        id: "li_1",
        metadata: { customization: { customText: { value: "a" } } },
      },
    ],
    [
      "an empty storage key",
      {
        id: "li_1",
        metadata: { customization: { artwork: { storageKey: "" } } },
      },
    ],
    [
      "a non-string storage key",
      {
        id: "li_1",
        metadata: { customization: { artwork: { storageKey: 7 } } },
      },
    ],
    [
      "customization that is not an object",
      { id: "li_1", metadata: { customization: "artwork/x.png" } },
    ],
  ])(
    "returns null for %s, so promotion skips it rather than throwing",
    (_label, item) => {
      expect(artworkKeyOnLineItem(item)).toBeNull();
    },
  );
});

describe("promoteArtworkHandler", () => {
  const STAGING_KEY = "staging/up_1.png";
  const FILED = new Date(Date.UTC(2026, 8, 11));

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
  };

  const missing = (name: string) =>
    Object.assign(new Error(name), {
      name,
      $metadata: { httpStatusCode: 404 },
    });

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

  function ledger(seed: ArtworkClaimRow[] = []) {
    const rows = seed.map((row) => ({ ...row }));
    const service = {
      findByStagingKey: jest.fn(async (key: string) =>
        key === STAGING_KEY ? { ...ASSET, claimed: rows.length > 0 } : null,
      ),
      claimLine: jest.fn(
        async (input: {
          assetId: string;
          orderId: string;
          lineItemId: string;
        }) => {
          const existing = rows.find(
            (row) => row.line_item_id === input.lineItemId,
          );
          if (existing) return { ...existing };

          const row: ArtworkClaimRow = {
            id: `claim_${input.lineItemId}`,
            asset_id: input.assetId,
            order_id: input.orderId,
            line_item_id: input.lineItemId,
            storage_key: null,
            promoted_at: null,
            purged_at: null,
            purge_reason: null,
            asset: ASSET,
          };
          rows.push(row);
          return { ...row };
        },
      ),
      listClaimsForAsset: jest.fn(async (assetId: string) =>
        rows
          .filter((row) => row.asset_id === assetId)
          .map((row) => ({ ...row })),
      ),
      markClaimPromoted: jest.fn(async (id: string, storageKey: string) => {
        const row = rows.find((candidate) => candidate.id === id);
        if (row) {
          Object.assign(row, { storage_key: storageKey, promoted_at: FILED });
        }
      }),
    };

    return { rows, service };
  }

  function run(
    orderId: string,
    lineItemIds: string[],
    service: ReturnType<typeof ledger>["service"],
  ) {
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const graph = jest.fn(async () => ({
      data: [
        {
          id: orderId,
          items: lineItemIds.map((id) => ({
            id,
            metadata: {
              customization: { artwork: { storageKey: STAGING_KEY } },
            },
          })),
        },
      ],
    }));

    const container = {
      resolve: (key: string) =>
        key === ContainerRegistrationKeys.QUERY
          ? { graph }
          : key === "artwork"
            ? service
            : (logger as unknown as Logger),
    };

    const promise = promoteArtworkHandler({
      event: { name: "order.placed", data: { id: orderId } },
      container,
      pluginOptions: {},
    } as unknown as SubscriberArgs<{ id: string }>);

    return { promise, logger };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("files every line of one order that shares an upload under its own key, claiming them all before copying any", async () => {
    const objects = bucket([STAGING_KEY]);
    const { rows, service } = ledger();

    await run("order_1", ["li_1", "li_2"], service).promise;

    expect(objects.has("artwork/order_1/li_1/up_1.png")).toBe(true);
    expect(objects.has("artwork/order_1/li_2/up_1.png")).toBe(true);
    expect(rows.map((row) => row.promoted_at)).toEqual([FILED, FILED]);
    expect(objects.has(STAGING_KEY)).toBe(false);
    expect(
      Math.max(...service.claimLine.mock.invocationCallOrder),
    ).toBeLessThan(Math.min(...copy.mock.invocationCallOrder));
  });

  it("files a later order on an already-filed upload from the earlier order's copy, and flags the shared upload", async () => {
    const objects = bucket(["artwork/order_A/li_A/up_1.png"]);
    const { rows, service } = ledger([
      {
        id: "claim_li_A",
        asset_id: "asset_1",
        order_id: "order_A",
        line_item_id: "li_A",
        storage_key: "artwork/order_A/li_A/up_1.png",
        promoted_at: FILED,
        purged_at: null,
        purge_reason: null,
        asset: ASSET,
      },
    ]);

    const { promise, logger } = run("order_B", ["li_B"], service);
    await promise;

    expect(objects.has("artwork/order_B/li_B/up_1.png")).toBe(true);
    expect(rows.find((row) => row.line_item_id === "li_B")?.storage_key).toBe(
      "artwork/order_B/li_B/up_1.png",
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "[artwork:promote-shared] asset=asset_1 order=order_B other_orders=order_A",
      ),
    );
  });

  it("keeps a line with nothing to copy from claimed and says so, rather than skipping it silently", async () => {
    bucket([]);
    const { rows, service } = ledger();

    const { promise, logger } = run("order_1", ["li_1"], service);
    await expect(promise).resolves.toBeUndefined();

    expect(rows).toHaveLength(1);
    expect(rows[0]?.promoted_at).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringMatching(/\[artwork:promote-failed\].*source_missing/),
    );
  });

  it("claims and copies nothing twice when order.placed is delivered again", async () => {
    bucket([STAGING_KEY]);
    const { rows, service } = ledger();

    await run("order_1", ["li_1"], service).promise;
    await run("order_1", ["li_1"], service).promise;

    expect(rows).toHaveLength(1);
    expect(copy).toHaveBeenCalledTimes(1);
  });
});
