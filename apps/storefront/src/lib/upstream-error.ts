import {
  parseCheckoutLineRefusals,
  type CheckoutLineRefusal,
  type CheckoutLineRefusalReason,
} from "@craftynp/types";

export type UpstreamErrorDetail = {
  upstreamStatus: number | null;
  reason: string;
};

export function describeUpstreamError(error: unknown): UpstreamErrorDetail {
  const upstreamStatus =
    error !== null &&
    typeof error === "object" &&
    "status" in error &&
    Number.isFinite(Number((error as { status: unknown }).status))
      ? Number((error as { status: unknown }).status)
      : null;

  return {
    upstreamStatus,
    reason: error instanceof Error ? error.message : String(error),
  };
}

export type PrepareFailureResponse =
  | {
      status: 400;
      body: {
        error: CheckoutLineRefusal["error"];
        reason: CheckoutLineRefusal["reason"];
        line: number;
        lines: CheckoutLineRefusal[];
      };
    }
  | {
      status: 502;
      body: { error: "checkout_unavailable" } & UpstreamErrorDetail;
    };

export function prepareFailureResponse(error: unknown): PrepareFailureResponse {
  const detail = describeUpstreamError(error);
  const lines =
    detail.upstreamStatus === 400
      ? parseCheckoutLineRefusals(detail.reason)
      : null;
  const first = lines?.[0];

  if (lines && first) {
    return {
      status: 400,
      body: {
        error: first.error,
        reason: first.reason,
        line: first.line,
        lines,
      },
    };
  }

  return { status: 502, body: { error: "checkout_unavailable", ...detail } };
}

const PRICE_QUOTE_REFUSAL_HEADS = {
  unknown_variant: { status: 400, head: "invalid_line" },
  bad_dimensions: { status: 400, head: "invalid_line" },
  unpriced: { status: 502, head: "price_unavailable" },
  unconfigured: { status: 502, head: "price_unavailable" },
} as const satisfies Partial<
  Record<
    CheckoutLineRefusalReason<"invalid_price_quote">,
    { status: number; head: string }
  >
>;

export type PriceQuoteRefusalReason = keyof typeof PRICE_QUOTE_REFUSAL_HEADS;

export function isPriceQuoteRefusalReason(
  value: unknown,
): value is PriceQuoteRefusalReason {
  return (
    typeof value === "string" && Object.hasOwn(PRICE_QUOTE_REFUSAL_HEADS, value)
  );
}

export type PriceQuoteFailureResponse =
  | {
      status: 400;
      body: { error: "price_unavailable"; reason: PriceQuoteRefusalReason };
    }
  | { status: 502; body: { error: "price_unavailable" } };

export function priceQuoteFailureResponse(
  error: unknown,
): PriceQuoteFailureResponse {
  const { upstreamStatus, reason: message } = describeUpstreamError(error);
  const [head = "", reason] = (message.split(" ", 1)[0] ?? "").split(":");

  if (isPriceQuoteRefusalReason(reason)) {
    const expected = PRICE_QUOTE_REFUSAL_HEADS[reason];
    if (expected.status === upstreamStatus && expected.head === head) {
      return { status: 400, body: { error: "price_unavailable", reason } };
    }
  }

  return { status: 502, body: { error: "price_unavailable" } };
}
