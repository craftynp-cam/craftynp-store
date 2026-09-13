import type { OrderAddress, OrderConfirmationLine } from "@craftynp/types";

import { formatMoney } from "./format-money";

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

// Order notes may run to several lines (CNP-38), and a detail joined onto one
// line is where those line breaks used to die. Each detail gets its own line in
// both bodies, and the breaks inside a value are carried rather than collapsed.
function detailsHtml(line: OrderConfirmationLine): string {
  return line.details
    .map(
      (detail) =>
        `${escapeHtml(detail.label)}: ${escapeHtml(detail.value).replace(/\n/g, "<br>")}`,
    )
    .join("<br>");
}

// Two spaces indent the detail block under its item, so a value's own newlines
// have to re-indent or the rest of the note reads as a new item.
function detailsText(line: OrderConfirmationLine): string {
  return line.details
    .map(
      (detail) => `  ${detail.label}: ${detail.value.replace(/\n/g, "\n  ")}`,
    )
    .join("\n");
}

function renderRow(line: OrderConfirmationLine, currencyCode: string): string {
  const details = detailsHtml(line);

  return [
    '<tr><td align="left" style="padding-top:12px; padding-bottom:12px; border-bottom:1px solid #e6e0d6;">',
    `<span style="${CELL} font-size:14px; line-height:20px; color:#04133b; font-weight:bold;">${escapeHtml(line.title)}</span><br>`,
    `<span style="${CELL} font-size:13px; line-height:19px; color:#5a6377;">Qty ${line.quantity}</span>`,
    details
      ? `<br><span style="${CELL} font-size:13px; line-height:19px; color:#5a6377;">${details}</span>`
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
    const details = detailsText(line);
    const row = [
      `${line.title} — Qty ${line.quantity} — ${formatMoney(line.lineTotal, currencyCode)}`,
      details,
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
