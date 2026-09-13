import type { ArtworkReference } from "@craftynp/types";

import type { ArtworkAssetRow } from "../modules/artwork/service";
import { artworkFromLedger } from "./artwork-ledger.js";
import {
  CHECKOUT_ARTWORK_MARGIN_DAYS,
  STAGING_WINDOW_DAYS,
} from "./artwork-retention.js";

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const NOW = new Date(Date.UTC(2026, 8, 13, 12));

const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY_MS);
const checkoutCutoff = daysAgo(
  STAGING_WINDOW_DAYS - CHECKOUT_ARTWORK_MARGIN_DAYS,
);

const REFERENCE: ArtworkReference = {
  storageKey: "staging/up_1.png",
  fileName: "logo.png",
  mimeType: "image/png",
  sizeBytes: 51_200,
  widthPx: 3000,
  heightPx: 3000,
};

function ledgerRow(overrides: Partial<ArtworkAssetRow> = {}): ArtworkAssetRow {
  return {
    id: "artasset_01",
    upload_id: "up_1",
    staging_key: "staging/up_1.png",
    storage_key: null,
    order_id: null,
    line_item_id: null,
    file_name: "logo.png",
    mime_type: "image/png",
    size_bytes: 51_200,
    uploaded_at: daysAgo(1),
    promoted_at: null,
    purged_at: null,
    purge_reason: null,
    width_px: 300,
    height_px: 200,
    inspected_at: daysAgo(1),
    ...overrides,
  };
}

describe("artworkFromLedger", () => {
  it("overwrites everything but the storage key with what the ledger recorded", () => {
    const forged: ArtworkReference = {
      ...REFERENCE,
      fileName: "renamed.svg",
      mimeType: "image/svg+xml",
      sizeBytes: 1,
      widthPx: null,
      heightPx: null,
    };

    expect(artworkFromLedger(forged, ledgerRow(), NOW)).toEqual({
      ok: true,
      artwork: {
        storageKey: "staging/up_1.png",
        fileName: "logo.png",
        mimeType: "image/png",
        sizeBytes: 51_200,
        widthPx: 300,
        heightPx: 200,
      },
    });
  });

  it.each([
    ["an upload with no ledger row", undefined],
    [
      "a purged upload",
      ledgerRow({ purged_at: daysAgo(0), purge_reason: "never_ordered" }),
    ],
    [
      "an upload already claimed by an order",
      ledgerRow({ order_id: "order_01", line_item_id: "item_01" }),
    ],
    ["an upload already promoted", ledgerRow({ promoted_at: daysAgo(0) })],
    [
      "an upload of a type the store refuses",
      ledgerRow({ mime_type: "image/gif" }),
    ],
    [
      "an upload whose staging object has aged out of the bucket",
      ledgerRow({ uploaded_at: daysAgo(STAGING_WINDOW_DAYS + 1) }),
    ],
    [
      "an upload just past the checkout margin, before its staging copy expires",
      ledgerRow({
        uploaded_at: new Date(checkoutCutoff.getTime() - MINUTE_MS),
      }),
    ],
  ])("reports %s as not found", (_label, row) => {
    expect(artworkFromLedger(REFERENCE, row, NOW)).toEqual({
      ok: false,
      reason: "artwork_not_found",
    });
  });

  it("accepts an upload just inside the checkout margin", () => {
    const row = ledgerRow({
      uploaded_at: new Date(checkoutCutoff.getTime() + MINUTE_MS),
    });

    expect(artworkFromLedger(REFERENCE, row, NOW)).toMatchObject({ ok: true });
  });

  it.each([
    [
      "a vector upload",
      { mime_type: "image/svg+xml", width_px: null, height_px: null },
    ],
    ["a raster upload that has pixels", {}],
  ] satisfies [string, Partial<ArtworkAssetRow>][])(
    "refuses %s that never went through inspect",
    (_label, overrides) => {
      const row = ledgerRow({ ...overrides, inspected_at: null });

      expect(artworkFromLedger(REFERENCE, row, NOW)).toEqual({
        ok: false,
        reason: "artwork_not_inspected",
      });
    },
  );

  it("refuses a raster upload whose pixels were never recorded", () => {
    const row = ledgerRow({ width_px: null, height_px: null });

    expect(artworkFromLedger(REFERENCE, row, NOW)).toEqual({
      ok: false,
      reason: "artwork_not_inspected",
    });
  });

  it("accepts an inspected vector upload, which has no pixels to record", () => {
    const row = ledgerRow({
      mime_type: "application/pdf",
      width_px: null,
      height_px: null,
    });

    expect(artworkFromLedger(REFERENCE, row, NOW)).toMatchObject({
      ok: true,
      artwork: { mimeType: "application/pdf", widthPx: null, heightPx: null },
    });
  });
});
