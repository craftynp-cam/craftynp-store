import {
  assertTransition,
  OrderStatusTransitionError,
  parseTrackingWebhook,
  trackingEventKey,
} from "./lib";

const RAW_BODY = '{"resource_type":"API_TRACK"}';

function envelope(data: Record<string, unknown>) {
  return {
    resource_url: "https://api.shipstation.com/v2/tracking?x=1",
    resource_type: "API_TRACK",
    data,
  };
}

describe("assertTransition", () => {
  it("passes a legal move through silently", () => {
    expect(() => assertTransition("packing", "shipped")).not.toThrow();
  });

  it("rejects an illegal move with an explanation the admin can show", () => {
    expect(() => assertTransition("received", "delivered")).toThrow(
      OrderStatusTransitionError,
    );

    try {
      assertTransition("received", "delivered");
    } catch (error) {
      expect(error).toMatchObject({ reason: "invalid_transition" });
      expect((error as Error).message).toContain("delivered");
    }
  });
});

describe("parseTrackingWebhook", () => {
  it("reads the fields it needs off the envelope", () => {
    const parsed = parseTrackingWebhook(
      envelope({
        tracking_number: "9400111899223197428490",
        status_code: "it",
        status_description: "In Transit",
        carrier_status_code: "OF",
        carrier_status_description: "Out for delivery",
        events: [],
      }),
    );

    expect(parsed).toMatchObject({
      trackingNumber: "9400111899223197428490",
      statusCode: "IT",
      statusDescription: "In Transit",
      carrierStatusDescription: "Out for delivery",
    });
  });

  it("takes the newest event timestamp, not the first one listed", () => {
    const parsed = parseTrackingWebhook(
      envelope({
        tracking_number: "94001118992231",
        status_code: "IT",
        events: [
          { occurred_at: "2026-07-01T10:00:00Z" },
          { occurred_at: "2026-07-03T08:00:00Z" },
          { occurred_at: "2026-07-02T09:00:00Z" },
        ],
      }),
    );

    expect(parsed?.occurredAt).toBe("2026-07-03T08:00:00Z");
  });

  it("skips events with an unparseable timestamp", () => {
    const parsed = parseTrackingWebhook(
      envelope({
        tracking_number: "94001118992231",
        status_code: "IT",
        events: [{ occurred_at: "not a date" }, { occurred_at: null }],
      }),
    );

    expect(parsed?.occurredAt).toBeNull();
  });

  it.each([
    ["a body that is not an object", "nonsense"],
    ["a body with no data", { resource_type: "API_TRACK" }],
    ["a payload with no tracking number", envelope({ status_code: "IT" })],
    [
      "a payload with no status code",
      envelope({ tracking_number: "94001118992231" }),
    ],
  ])("returns null for %s", (_label, body) => {
    expect(parseTrackingWebhook(body)).toBeNull();
  });
});

describe("trackingEventKey", () => {
  const base = {
    trackingNumber: "94001118992231",
    statusCode: "IT",
    statusDescription: null,
    carrierStatusCode: null,
    carrierStatusDescription: null,
  };

  it("is stable across redeliveries of the same event", () => {
    const payload = { ...base, occurredAt: "2026-07-03T08:00:00Z" };

    expect(trackingEventKey(payload, RAW_BODY)).toBe(
      trackingEventKey(payload, RAW_BODY),
    );
  });

  it("separates two scans of the same status at different times", () => {
    const first = { ...base, occurredAt: "2026-07-03T08:00:00Z" };
    const second = { ...base, occurredAt: "2026-07-04T08:00:00Z" };

    expect(trackingEventKey(first, RAW_BODY)).not.toBe(
      trackingEventKey(second, RAW_BODY),
    );
  });

  it("falls back to the body digest when the event carries no timestamp", () => {
    const payload = { ...base, occurredAt: null };

    expect(trackingEventKey(payload, RAW_BODY)).toBe(
      trackingEventKey(payload, RAW_BODY),
    );
    expect(trackingEventKey(payload, RAW_BODY)).not.toBe(
      trackingEventKey(payload, '{"different":true}'),
    );
  });
});
