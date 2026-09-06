import {
  DEFAULT_FALLBACK_DAYS,
  DEFAULT_RETENTION_DAYS,
  STAGING_WINDOW_DAYS,
  purgeDueAt,
  readRetentionPolicy,
  selectPurgeCandidates,
  stagingWindowClosedBefore,
  type PurgeCandidate,
} from "./artwork-retention.js";

const POLICY = { retentionDays: 30, fallbackDays: 60 };

const day = (n: number) => new Date(Date.UTC(2026, 0, n));

describe("readRetentionPolicy", () => {
  it("defaults to the window the client asked for", () => {
    expect(readRetentionPolicy({})).toEqual({
      retentionDays: DEFAULT_RETENTION_DAYS,
      fallbackDays: DEFAULT_FALLBACK_DAYS,
    });
  });

  it("reads configured values", () => {
    expect(
      readRetentionPolicy({
        ARTWORK_RETENTION_DAYS: "14",
        ARTWORK_RETENTION_FALLBACK_DAYS: "45",
      }),
    ).toEqual({ retentionDays: 14, fallbackDays: 45 });
  });

  it("accepts zero, so retention can be collapsed deliberately when testing a purge", () => {
    expect(
      readRetentionPolicy({ ARTWORK_RETENTION_DAYS: "0" }).retentionDays,
    ).toBe(0);
  });

  it.each(["thirty", "-1", "1.5", ""])(
    "ignores %p rather than letting a typo decide how long artwork is kept",
    (value) => {
      expect(
        readRetentionPolicy({ ARTWORK_RETENTION_DAYS: value }).retentionDays,
      ).toBe(DEFAULT_RETENTION_DAYS);
    },
  );
});

describe("purgeDueAt", () => {
  it("runs the window from delivery, so an order still in production is never purged mid-build", () => {
    expect(
      purgeDueAt({ uploadedAt: day(1), deliveredAt: day(50) }, POLICY),
    ).toEqual(day(80));
  });

  it("falls back to upload date when an order never reaches delivered", () => {
    expect(
      purgeDueAt({ uploadedAt: day(1), deliveredAt: null }, POLICY),
    ).toEqual(day(61));
  });

  it("gives a late delivery its full window rather than capping at the fallback", () => {
    // Delivered on day 56, past the day-61 upload fallback. The file must
    // still survive to day 86 — the fallback is a default, not a ceiling.
    expect(
      purgeDueAt({ uploadedAt: day(1), deliveredAt: day(56) }, POLICY),
    ).toEqual(day(86));
  });
});

describe("selectPurgeCandidates", () => {
  const base: PurgeCandidate = {
    id: "art_1",
    storage_key: "artwork/order_1/li_1/01JX.png",
    promoted_at: day(2),
    purged_at: null,
    uploaded_at: day(1),
  };

  it("returns a due asset with the reason its clock ran on", () => {
    const result = selectPurgeCandidates(
      [base],
      new Map([["art_1", day(10)]]),
      day(41),
      POLICY,
    );

    expect(result).toEqual([{ row: base, reason: "delivered" }]);
  });

  it("marks an undelivered asset as such, so the log says which clock fired", () => {
    const result = selectPurgeCandidates([base], new Map(), day(62), POLICY);

    expect(result[0]?.reason).toBe("undelivered");
  });

  it("leaves an asset alone until its window closes", () => {
    expect(
      selectPurgeCandidates(
        [base],
        new Map([["art_1", day(10)]]),
        day(39),
        POLICY,
      ),
    ).toEqual([]);
  });

  it("skips an asset already purged, so a rerun cannot double-count it", () => {
    expect(
      selectPurgeCandidates(
        [{ ...base, purged_at: day(40) }],
        new Map(),
        day(200),
        POLICY,
      ),
    ).toEqual([]);
  });

  it("skips an upload never promoted onto an order, which the staging lifecycle rule owns", () => {
    expect(
      selectPurgeCandidates(
        [{ ...base, promoted_at: null, storage_key: null }],
        new Map(),
        day(200),
        POLICY,
      ),
    ).toEqual([]);
  });
});

describe("stagingWindowClosedBefore", () => {
  it("marks anything older than the staging window as past saving", () => {
    // Beyond this the staging object is gone, so a promotion that has not
    // succeeded never will. It must agree with the bucket's staging/ rule.
    expect(stagingWindowClosedBefore(day(30))).toEqual(
      day(30 - STAGING_WINDOW_DAYS),
    );
  });
});
