import {
  signOrderAccessToken,
  verifyOrderAccessToken,
} from "./order-access-token.js";

const secret = "test-secret";
const nowMs = Date.parse("2026-07-30T00:00:00.000Z");
const orderId = "order_01ABC";

function issueToken(overrides: { oid?: string; exp?: number } = {}) {
  return signOrderAccessToken(
    {
      oid: overrides.oid ?? orderId,
      exp: overrides.exp ?? nowMs + 90 * 24 * 60 * 60 * 1000,
    },
    secret,
  );
}

describe("verifyOrderAccessToken", () => {
  it("accepts a token it issued for the same order", () => {
    const result = verifyOrderAccessToken(issueToken(), secret, {
      orderId,
      nowMs,
    });

    expect(result).toEqual({
      valid: true,
      payload: expect.objectContaining({ v: 1, oid: orderId }),
    });
  });

  it("rejects a token signed with a different secret", () => {
    const forged = signOrderAccessToken(
      { oid: orderId, exp: nowMs + 60_000 },
      "other-secret",
    );

    expect(verifyOrderAccessToken(forged, secret, { orderId, nowMs })).toEqual({
      valid: false,
      reason: "bad_signature",
    });
  });

  it("rejects a tampered payload", () => {
    const [json, signature] = issueToken().split(".");
    const tampered = `${json}x.${signature}`;

    expect(
      verifyOrderAccessToken(tampered, secret, { orderId, nowMs }),
    ).toEqual({ valid: false, reason: "bad_signature" });
  });

  it("rejects an expired token", () => {
    const token = issueToken({ exp: nowMs - 1 });

    expect(verifyOrderAccessToken(token, secret, { orderId, nowMs })).toEqual({
      valid: false,
      reason: "expired",
    });
  });

  it("rejects a valid token presented against another order", () => {
    const token = issueToken({ oid: "order_SOMEONE_ELSE" });

    expect(verifyOrderAccessToken(token, secret, { orderId, nowMs })).toEqual({
      valid: false,
      reason: "order_mismatch",
    });
  });

  it("fails closed when no secret is configured, rather than verifying against an empty key", () => {
    // An empty HMAC key produces a signature any caller could compute, so a
    // token that verifies against one is worthless.
    const forged = signOrderAccessToken(
      { oid: orderId, exp: nowMs + 60_000 },
      "anything",
    );

    expect(verifyOrderAccessToken(forged, "", { orderId, nowMs })).toEqual({
      valid: false,
      reason: "not_configured",
    });
  });

  it("refuses to mint a token without a secret", () => {
    expect(() =>
      signOrderAccessToken({ oid: orderId, exp: nowMs + 60_000 }, ""),
    ).toThrow("ORDER_ACCESS_SECRET is not set");
  });

  it("rejects a token that is not two dot-separated parts", () => {
    expect(
      verifyOrderAccessToken("not-a-token", secret, { orderId, nowMs }),
    ).toEqual({ valid: false, reason: "malformed" });
  });
});
