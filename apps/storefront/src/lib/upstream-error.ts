import {
  parseCheckoutLineRefusals,
  type CheckoutLineRefusal,
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
