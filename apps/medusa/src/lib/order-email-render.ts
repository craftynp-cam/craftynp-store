import type { OrderAddress, OrderConfirmationLine } from "@craftynp/types";

import { formatMoney } from "./format-money";

// Resend caps a single template variable at 2,000 characters and rejects the
// whole send past it. Budget under that so a long order degrades to a
// "+N more" row instead of no email at all.
export const MAX_VARIABLE_CHARS = 1900;

const CELL = "font-family:Arial,Helvetica,sans-serif;";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function detailLine(line: OrderConfirmationLine): string {
  return line.details
    .map((detail) => `${detail.label}: ${detail.value}`)
    .join(" · ");
}

function renderRow(line: OrderConfirmationLine, currencyCode: string): string {
  const details = detailLine(line);

  return [
    '<tr><td align="left" style="padding-top:12px; padding-bottom:12px; border-bottom:1px solid #e6e0d6;">',
    `<span style="${CELL} font-size:14px; line-height:20px; color:#04133b; font-weight:bold;">${escapeHtml(line.title)}</span><br>`,
    `<span style="${CELL} font-size:13px; line-height:19px; color:#5a6377;">Qty ${line.quantity}</span>`,
    details
      ? `<br><span style="${CELL} font-size:13px; line-height:19px; color:#5a6377;">${escapeHtml(details)}</span>`
      : "",
    `</td><td align="right" valign="top" style="padding-top:12px; padding-bottom:12px; border-bottom:1px solid #e6e0d6; ${CELL} font-size:14px; line-height:20px; color:#04133b; font-weight:bold;">`,
    escapeHtml(formatMoney(line.lineTotal, currencyCode)),
    "</td></tr>",
  ].join("");
}

function overflowRow(remaining: number, orderUrl: string): string {
  return [
    '<tr><td colspan="2" align="left" style="padding-top:12px; padding-bottom:12px;">',
    `<a href="${escapeHtml(orderUrl)}" style="${CELL} font-size:13px; line-height:19px; color:#04133b;">`,
    `and ${remaining} more item${remaining === 1 ? "" : "s"} — view your full order</a>`,
    "</td></tr>",
  ].join("");
}

export function renderOrderItemsHtml(
  lines: readonly OrderConfirmationLine[],
  currencyCode: string,
  orderUrl: string,
): string {
  const rows: string[] = [];
  let used = 0;

  for (const [index, line] of lines.entries()) {
    const row = renderRow(line, currencyCode);
    const remaining = lines.length - index;
    const overflow = overflowRow(remaining, orderUrl);

    // Only commit this row if the overflow row that might have to follow it
    // still fits, otherwise the budget is blown by the very thing meant to
    // rescue it.
    if (used + row.length + overflow.length > MAX_VARIABLE_CHARS) {
      rows.push(overflow);
      return rows.join("");
    }

    rows.push(row);
    used += row.length;
  }

  return rows.join("");
}

export function renderOrderItemsText(
  lines: readonly OrderConfirmationLine[],
  currencyCode: string,
): string {
  const rendered: string[] = [];
  let used = 0;

  for (const [index, line] of lines.entries()) {
    const details = detailLine(line);
    const row = [
      `${line.title} — Qty ${line.quantity} — ${formatMoney(line.lineTotal, currencyCode)}`,
      details ? `  ${details}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const remaining = lines.length - index;
    const overflow = `and ${remaining} more item${remaining === 1 ? "" : "s"} — view your full order`;

    if (used + row.length + overflow.length + 2 > MAX_VARIABLE_CHARS) {
      rendered.push(overflow);
      return rendered.join("\n");
    }

    rendered.push(row);
    used += row.length + 1;
  }

  return rendered.join("\n");
}

function addressLines(address: OrderAddress): string[] {
  return [
    [address.firstName, address.lastName].filter(Boolean).join(" "),
    [address.address1, address.address2].filter(Boolean).join(", "),
    [
      address.city,
      [address.state, address.postalCode].filter(Boolean).join(" "),
    ]
      .filter(Boolean)
      .join(", "),
  ].filter(Boolean);
}

export function renderAddressHtml(address: OrderAddress | null): string {
  if (!address) return "";

  return addressLines(address)
    .map(
      (line) =>
        `<p style="margin-top:0; margin-bottom:2px; ${CELL} font-size:14px; line-height:21px; color:#04133b;">${escapeHtml(line)}</p>`,
    )
    .join("");
}

export function renderAddressText(address: OrderAddress | null): string {
  if (!address) return "";
  return addressLines(address).join("\n");
}
