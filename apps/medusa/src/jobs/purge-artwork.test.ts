import type { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

import { deleteArtwork } from "../lib/artwork-storage";
import { ORDER_STATUS_MODULE } from "../modules/order-status";
import type { ArtworkClaimRow } from "../modules/artwork/service";
import { purgeArtwork } from "./purge-artwork.js";

jest.mock("../lib/artwork-storage", () => ({
  ...jest.requireActual("../lib/artwork-storage"),
  deleteArtwork: jest.fn(),
}));

const remove = deleteArtwork as jest.MockedFunction<typeof deleteArtwork>;

const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS);

const ASSET: ArtworkClaimRow["asset"] = {
  id: "asset_1",
  upload_id: "up_1",
  staging_key: "staging/up_1.png",
  file_name: "logo.png",
  mime_type: "image/png",
  size_bytes: 51_200,
  uploaded_at: daysAgo(50),
  purged_at: null,
  purge_reason: null,
  width_px: 3000,
  height_px: 3000,
  inspected_at: daysAgo(50),
};

function filed(order: string, line: string): ArtworkClaimRow {
  return {
    id: `claim_${order}`,
    asset_id: "asset_1",
    order_id: order,
    line_item_id: line,
    storage_key: `artwork/${order}/${line}/up_1.png`,
    promoted_at: daysAgo(49),
    purged_at: null,
    purge_reason: null,
    asset: ASSET,
  };
}

const saved = { ...process.env };

beforeEach(() => {
  jest.clearAllMocks();
  process.env.ARTWORK_RETENTION_DAYS = "30";
  process.env.ARTWORK_RETENTION_FALLBACK_DAYS = "60";
  remove.mockResolvedValue(undefined);
});

afterAll(() => {
  process.env = saved;
});

describe("purgeArtwork", () => {
  it("purges each line's own copy of a shared upload on its own order's delivery clock", async () => {
    const artwork = {
      listPromotedUnpurgedClaims: jest.fn(async () => [
        filed("order_A", "li_A"),
        filed("order_B", "li_B"),
      ]),
      markClaimPurged: jest.fn().mockResolvedValue(undefined),
    };
    const orderStatus = {
      deliveredAtByOrder: jest.fn(
        async () =>
          new Map([
            ["order_A", daysAgo(40)],
            ["order_B", daysAgo(5)],
          ]),
      ),
    };
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const container = {
      resolve: (key: string) =>
        key === ContainerRegistrationKeys.LOGGER
          ? logger
          : key === "artwork"
            ? artwork
            : key === ORDER_STATUS_MODULE
              ? orderStatus
              : undefined,
    } as unknown as MedusaContainer;

    await purgeArtwork(container);

    expect(remove.mock.calls).toEqual([["artwork/order_A/li_A/up_1.png"]]);
    expect(artwork.markClaimPurged.mock.calls).toEqual([
      ["claim_order_A", "delivered"],
    ]);
  });
});
