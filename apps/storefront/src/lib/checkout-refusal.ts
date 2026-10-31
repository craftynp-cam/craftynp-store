import {
  isCheckoutLineRefusal,
  type CheckoutLineRefusal,
  type CheckoutLineRefusalError,
  type CheckoutLineRefusalReason,
} from "@craftynp/types";

import type { CartLine } from "./cart";
import { productEditHref } from "./routes";
import { isPriceQuoteRefusalReason } from "./upstream-error";

export type CheckoutLineProblem = {
  lineId: string;
  itemName: string;
  message: string;
  action: "edit" | "remove";
  editHref: string;
};

const REUPLOAD_ARTWORK =
  "Your artwork for this item needs uploading again — open the item and press Replace.";
const NEEDS_A_CHANGE = "This item needs a change before we can make it.";
const NO_LONGER_AVAILABLE =
  "This item is no longer available as configured — remove it to continue.";
const PRICE_UNCONFIRMED =
  "We couldn't confirm this item's price — open it to refresh.";

const LINE_REFUSAL_MESSAGES = {
  invalid_customization: {
    unknown_variant: NO_LONGER_AVAILABLE,
    artwork_not_found: REUPLOAD_ARTWORK,
    artwork_not_inspected: REUPLOAD_ARTWORK,
    missing_required: NEEDS_A_CHANGE,
    input_off: NEEDS_A_CHANGE,
    rejected: NEEDS_A_CHANGE,
  },
  invalid_price_quote: {
    missing: PRICE_UNCONFIRMED,
    malformed: PRICE_UNCONFIRMED,
    bad_signature: PRICE_UNCONFIRMED,
    expired: PRICE_UNCONFIRMED,
    line_mismatch: PRICE_UNCONFIRMED,
    unknown_variant: NO_LONGER_AVAILABLE,
    unpriced: NO_LONGER_AVAILABLE,
    unconfigured: NO_LONGER_AVAILABLE,
    bad_dimensions: NEEDS_A_CHANGE,
  },
} satisfies {
  [E in CheckoutLineRefusalError]: Record<CheckoutLineRefusalReason<E>, string>;
};

const REQUOTABLE_PRICE_REASONS: readonly string[] = [
  "expired",
  "malformed",
  "bad_signature",
  "line_mismatch",
];

export function isRequotableRefusal(refusal: CheckoutLineRefusal): boolean {
  return (
    refusal.error === "invalid_price_quote" &&
    REQUOTABLE_PRICE_REASONS.includes(refusal.reason)
  );
}

export function refusalsFromBody(body: unknown): CheckoutLineRefusal[] | null {
  const lines =
    typeof body === "object" && body !== null
      ? (body as { lines?: unknown }).lines
      : undefined;

  if (!Array.isArray(lines) || lines.length === 0) return null;
  return lines.every(isCheckoutLineRefusal) ? lines : null;
}

export function priceQuoteRefusal(
  body: unknown,
  line: number,
): CheckoutLineRefusal | null {
  const reason =
    typeof body === "object" && body !== null
      ? (body as { reason?: unknown }).reason
      : undefined;

  return isPriceQuoteRefusalReason(reason)
    ? { error: "invalid_price_quote", reason, line }
    : null;
}

function cartLineName(line: CartLine): string {
  const detail =
    line.details?.find(({ label }) => label === "Size") ??
    line.details?.find(({ label }) => label === "Artwork");

  return detail ? `${line.title} (${detail.value})` : line.title;
}

export function lineProblems(
  sent: readonly CartLine[],
  refusals: readonly CheckoutLineRefusal[],
): CheckoutLineProblem[] | null {
  const problems: CheckoutLineProblem[] = [];

  for (const refusal of refusals) {
    const line = sent[refusal.line];
    if (!line) return null;

    const messages: Record<string, string> =
      LINE_REFUSAL_MESSAGES[refusal.error];

    const message = messages[refusal.reason] ?? NEEDS_A_CHANGE;

    problems.push({
      lineId: line.lineId,
      itemName: cartLineName(line),
      message,
      action: message === NO_LONGER_AVAILABLE ? "remove" : "edit",
      editHref: productEditHref(line.href, line.lineId),
    });
  }

  return problems;
}
