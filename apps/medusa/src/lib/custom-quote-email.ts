import type { CustomQuoteRequest } from "@craftynp/types";

import type { OrderEmailContent } from "./order-email";
import { escapeHtml } from "./order-email-render";

function formatNeededBy(isoDate: string): string {
  if (!isoDate) return "No date given";
  const date = new Date(`${isoDate}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function customQuoteEmailContent(
  request: CustomQuoteRequest,
): OrderEmailContent {
  const rows: [string, string][] = [
    ["Name", request.name],
    ["Phone", request.phone],
    ["Email", request.email],
    ["Date needed", formatNeededBy(request.neededBy)],
    ["Product", request.product],
  ];

  const htmlRows = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:4px 16px 4px 0; font-weight:bold; vertical-align:top;">${escapeHtml(label)}</td><td style="padding:4px 0;">${escapeHtml(value)}</td></tr>`,
    )
    .join("");

  const description = escapeHtml(request.description).replace(/\r?\n/g, "<br>");

  return {
    subject: `Custom quote request: ${request.product} — ${request.name}`,
    html: `<div style="font-family:Arial,Helvetica,sans-serif; font-size:14px; line-height:21px; color:#04133b;">
<h1 style="font-size:18px;">Custom quote request</h1>
<table style="border-collapse:collapse;">${htmlRows}</table>
<h2 style="font-size:16px; margin-top:16px;">Description</h2>
<p>${description}</p>
<p style="color:#555;">Reply to this email to answer ${escapeHtml(request.name)} directly.</p>
</div>`,
    text: [
      "Custom quote request",
      "",
      ...rows.map(([label, value]) => `${label}: ${value}`),
      "",
      "Description:",
      request.description,
      "",
      `Reply to this email to answer ${request.name} directly.`,
    ].join("\n"),
  };
}
