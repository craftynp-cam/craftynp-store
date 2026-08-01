import {
  allowedTransitions,
  canTransition,
  carrierTrackingUrl,
  trackingStatusFromShipStation,
  transitionRejection,
  type OrderStatus,
} from "./order-status.js";

const LEGAL: [OrderStatus, OrderStatus][] = [
  ["received", "packing"],
  ["received", "cancelled"],
  ["packing", "in_production"],
  ["packing", "shipped"],
  ["packing", "cancelled"],
  ["in_production", "packing"],
  ["in_production", "shipped"],
  ["in_production", "cancelled"],
  ["shipped", "delivered"],
  ["shipped", "packing"],
];

const ILLEGAL: [OrderStatus, OrderStatus][] = [
  ["received", "shipped"],
  ["received", "delivered"],
  ["received", "in_production"],
  ["packing", "received"],
  ["packing", "delivered"],
  ["in_production", "received"],
  ["shipped", "cancelled"],
  ["shipped", "received"],
  ["delivered", "packing"],
  ["delivered", "shipped"],
  ["cancelled", "packing"],
  ["cancelled", "received"],
];

describe("canTransition", () => {
  it.each(LEGAL)("allows %s to %s", (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it.each(ILLEGAL)("rejects %s to %s", (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });
});

describe("transitionRejection", () => {
  it.each(LEGAL)("returns null for the legal move %s to %s", (from, to) => {
    expect(transitionRejection(from, to)).toBeNull();
  });

  it.each(ILLEGAL)("explains why %s cannot become %s", (from, to) => {
    const rejection = transitionRejection(from, to);
    expect(rejection).toEqual(expect.any(String));
    expect(rejection).toContain(to.replace(/_/g, " "));
  });

  it("says a terminal status is final rather than listing alternatives", () => {
    expect(transitionRejection("delivered", "packing")).toContain("final");
  });

  it("says so when the order is already in the requested status", () => {
    expect(transitionRejection("packing", "packing")).toContain("already");
  });

  it("names the moves that are available instead", () => {
    expect(transitionRejection("received", "shipped")).toContain("packing");
  });
});

describe("allowedTransitions", () => {
  it("offers the owner only packing and cancelled from received", () => {
    expect([...allowedTransitions("received")]).toEqual([
      "packing",
      "cancelled",
    ]);
  });

  it("offers nothing once delivered", () => {
    expect([...allowedTransitions("delivered")]).toEqual([]);
  });
});

describe("carrierTrackingUrl", () => {
  it.each([
    ["usps", "tools.usps.com"],
    ["stamps_com", "tools.usps.com"],
    ["ups", "ups.com"],
    ["fedex", "fedex.com"],
    ["dhl_express", "dhl.com"],
  ])("builds a %s tracking link", (carrierCode, host) => {
    const url = carrierTrackingUrl(carrierCode, "9400111899223197428490");
    expect(url).toContain(host);
    expect(url).toContain("9400111899223197428490");
  });

  it("ignores carrier code casing and surrounding whitespace", () => {
    expect(carrierTrackingUrl(" USPS ", "94001118992231")).toContain(
      "tools.usps.com",
    );
  });

  it("returns null for a carrier it has no template for", () => {
    expect(carrierTrackingUrl("royal_mail", "94001118992231")).toBeNull();
  });

  it("returns null when there is no tracking number", () => {
    expect(carrierTrackingUrl("usps", "")).toBeNull();
    expect(carrierTrackingUrl("usps", null)).toBeNull();
  });

  it("encodes the tracking number into the query string", () => {
    expect(carrierTrackingUrl("usps", "94 001/118")).toContain("94%20001%2F118");
  });
});

describe("trackingStatusFromShipStation", () => {
  it.each([
    ["AC", "accepted"],
    ["NY", "in_transit"],
    ["IT", "in_transit"],
    ["AT", "exception"],
    ["EX", "exception"],
    ["DE", "delivered"],
    ["SP", "delivered"],
    ["UN", "unknown"],
  ])("maps %s onto %s", (code, expected) => {
    expect(trackingStatusFromShipStation(code)).toBe(expected);
  });

  it("falls back to unknown for a code it has never seen", () => {
    expect(trackingStatusFromShipStation("ZZ")).toBe("unknown");
    expect(trackingStatusFromShipStation(null)).toBe("unknown");
  });

  it("promotes in transit to out for delivery when the carrier says so", () => {
    expect(trackingStatusFromShipStation("IT", "Out for delivery")).toBe(
      "out_for_delivery",
    );
  });

  it("does not promote a delivered shipment on carrier wording", () => {
    expect(trackingStatusFromShipStation("DE", "Out for delivery")).toBe(
      "delivered",
    );
  });
});
