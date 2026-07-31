import { describeUpstreamError } from "@/lib/upstream-error";

class FetchErrorLike extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

describe("describeUpstreamError", () => {
  it("keeps the status and message from a FetchError", () => {
    expect(
      describeUpstreamError(
        new FetchErrorLike("invalid_shipping_quote:bad_signature", 400),
      ),
    ).toEqual({
      upstreamStatus: 400,
      reason: "invalid_shipping_quote:bad_signature",
    });
  });

  it("reports a null status when the failure never reached Medusa", () => {
    // A connection refused or DNS failure rejects with a plain Error, which
    // carries no status at all — distinguishing that from a 400 is the whole
    // point of forwarding the status.
    expect(describeUpstreamError(new Error("fetch failed"))).toEqual({
      upstreamStatus: null,
      reason: "fetch failed",
    });
  });

  it("ignores a non-numeric status rather than reporting NaN", () => {
    expect(
      describeUpstreamError(
        Object.assign(new Error("odd"), { status: "nonsense" }),
      ).upstreamStatus,
    ).toBeNull();
  });

  it("stringifies a thrown non-Error", () => {
    expect(describeUpstreamError("boom")).toEqual({
      upstreamStatus: null,
      reason: "boom",
    });
  });
});
