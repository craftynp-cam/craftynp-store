import {
  describeUpstreamError,
  prepareFailureResponse,
  priceQuoteFailureResponse,
} from "@/lib/upstream-error";

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

describe("prepareFailureResponse", () => {
  it("passes a refused line through as a 400 naming every refused line", () => {
    expect(
      prepareFailureResponse(
        new FetchErrorLike(
          "invalid_customization:missing_required:dimensions@1,invalid_price_quote:expired@2 line 1: detail",
          400,
        ),
      ),
    ).toEqual({
      status: 400,
      body: {
        error: "invalid_customization",
        reason: "missing_required",
        line: 1,
        lines: [
          {
            error: "invalid_customization",
            reason: "missing_required",
            input: "dimensions",
            line: 1,
          },
          { error: "invalid_price_quote", reason: "expired", line: 2 },
        ],
      },
    });
  });

  it.each([
    [
      "a refusal about the whole checkout",
      new FetchErrorLike("invalid_tax_quote:expired", 400),
      400,
    ],
    [
      "an older Medusa's refusal that names no line",
      new FetchErrorLike("invalid_customization:artwork_not_found", 400),
      400,
    ],
    [
      "a line-shaped message on a server error",
      new FetchErrorLike("invalid_price_quote:expired@0", 502),
      502,
    ],
    ["a failure that never reached Medusa", new Error("fetch failed"), null],
  ])("keeps %s as today's 502", (_case, error, upstreamStatus) => {
    expect(prepareFailureResponse(error)).toEqual({
      status: 502,
      body: {
        error: "checkout_unavailable",
        upstreamStatus,
        reason: error.message,
      },
    });
  });
});

describe("priceQuoteFailureResponse", () => {
  it.each([
    [
      "unknown_variant",
      new FetchErrorLike("invalid_line:unknown_variant unknown variant v_1", 400),
    ],
    [
      "bad_dimensions",
      new FetchErrorLike(
        "invalid_line:bad_dimensions Enter a height between 2 and 48 inches.",
        400,
      ),
    ],
    [
      "unpriced",
      new FetchErrorLike(
        "price_unavailable:unpriced variant v_1 has no price in this region",
        502,
      ),
    ],
    [
      "unconfigured",
      new FetchErrorLike(
        "price_unavailable:unconfigured this product has no custom size pricing configured",
        502,
      ),
    ],
  ])("names a line Medusa refuses to price as %s", (reason, error) => {
    expect(priceQuoteFailureResponse(error)).toEqual({
      status: 400,
      body: { error: "price_unavailable", reason },
    });
  });

  it.each([
    ["a rate limit", new FetchErrorLike("Too many requests", 429)],
    [
      "a misconfigured store",
      new FetchErrorLike("price_unavailable:misconfigured", 502),
    ],
    ["a failure that never reached Medusa", new Error("fetch failed")],
    [
      "an older Medusa's message with no head",
      new FetchErrorLike("unknown variant v_1", 400),
    ],
  ])("keeps %s a retryable 502", (_case, error) => {
    expect(priceQuoteFailureResponse(error)).toEqual({
      status: 502,
      body: { error: "price_unavailable" },
    });
  });
});
