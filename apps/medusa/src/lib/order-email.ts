import { SITE_NAME, SITE_TAGLINE } from "@craftynp/types";
import type { OrderConfirmation } from "@craftynp/types";

import { formatMoney } from "./format-money";
import { orderAccessTtlMs, signOrderAccessToken } from "./order-access-token";
import {
  escapeHtml,
  renderAddressHtml,
  renderAddressText,
  renderOrderItemsHtml,
  renderOrderItemsText,
} from "./order-email-render";

export const ORDER_EMAIL_FAILED_LOG_TAG = "[email:order-failed]";

export type OrderEmailContent = {
  subject: string;
  html: string;
  text: string;
};

export function orderReference(displayId: number): string {
  return `#CNP-${displayId}`;
}

export function formatOrderDate(isoDate: string): string {
  if (!isoDate) return "";
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function storefrontUrl(): string {
  return (process.env.STOREFRONT_URL ?? "http://localhost:8000").replace(
    /\/+$/,
    "",
  );
}

const BRAND_FONT = "'Cookie','Brush Script MT','Segoe Script',cursive";

const BRAND_FONT_LINK =
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cookie&amp;display=swap">';

function brandHeaderHtml(dateLabel: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td align="left" valign="middle" width="104" style="width:104px;">
<img src="${storefrontUrl()}/logo.png" width="104" height="93" alt="${SITE_NAME}" style="display:block; border:0;">
</td>
<td align="right" valign="middle" style="font-family:Arial,Helvetica,sans-serif; font-size:13px; line-height:18px; color:#5a6377;">
${dateLabel}
</td>
</tr>
<tr>
<td colspan="2" style="padding-top:12px; font-family:Arial,Helvetica,sans-serif; font-size:11px; line-height:15px; letter-spacing:0.5px; color:#5a6377;">
${SITE_TAGLINE}
</td>
</tr>
</table>`;
}

function brandFooterWordmarkHtml(): string {
  return `<p style="margin-top:0; margin-bottom:8px; font-family:${BRAND_FONT}; font-size:26px; line-height:30px; color:#fbfaf7;">${SITE_NAME}</p>`;
}

export function orderConfirmationUrl(order: OrderConfirmation): string {
  const params = new URLSearchParams({
    order: order.orderId,
    number: String(order.displayId),
  });

  try {
    params.set(
      "token",
      signOrderAccessToken(
        {
          oid: order.orderId,
          exp:
            Date.now() +
            orderAccessTtlMs(Number(process.env.ORDER_ACCESS_TOKEN_TTL_DAYS)),
        },
        process.env.ORDER_ACCESS_SECRET ?? "",
      ),
    );
  } catch {}

  return `${storefrontUrl()}/checkout/confirmation?${params.toString()}`;
}

export function customerFirstName(order: OrderConfirmation): string {
  return order.shippingAddress?.firstName || "there";
}

export type OrderEmailNotes = {
  turnaroundNote: string;
  shippingWindowNote: string;
};

export function orderConfirmationContent(
  order: OrderConfirmation,
  notes: OrderEmailNotes,
): OrderEmailContent {
  const orderUrl = orderConfirmationUrl(order);
  const shopUrl = `${storefrontUrl()}/products`;
  const { currencyCode } = order.totals;
  const orderNumber = orderReference(order.displayId);
  const orderDate = escapeHtml(formatOrderDate(order.placedAt));
  const customerName = escapeHtml(customerFirstName(order));
  const shippingMethod = escapeHtml(
    order.shippingMethodName ?? "Standard shipping",
  );
  const turnaroundNote = escapeHtml(notes.turnaroundNote);
  const shippingWindowNote = escapeHtml(notes.shippingWindowNote);
  const shopAddress = escapeHtml(process.env.SHOP_POSTAL_ADDRESS ?? SITE_NAME);
  const itemsHtml = renderOrderItemsHtml(order.lines, currencyCode, orderUrl);
  const itemsText = renderOrderItemsText(order.lines, currencyCode);
  const addressHtml = renderAddressHtml(order.shippingAddress);
  const addressText = renderAddressText(order.shippingAddress);
  const subtotal = formatMoney(order.totals.subtotal, currencyCode);
  const shipping = formatMoney(order.totals.shipping, currencyCode);
  const tax = formatMoney(order.totals.tax, currencyCode);
  const total = formatMoney(order.totals.total, currencyCode);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Your order is confirmed</title>
${BRAND_FONT_LINK}
</head>
<body style="margin:0; padding:0; background-color:#ecebe6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ecebe6" style="background-color:#ecebe6;">
<tr>
<td align="center" style="padding-top:32px; padding-bottom:32px; padding-left:12px; padding-right:12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px;">
<tr>
<td bgcolor="#ffffff" style="background-color:#ffffff; padding-top:20px; padding-bottom:20px; padding-left:28px; padding-right:28px; border-top-left-radius:10px; border-top-right-radius:10px;">
${brandHeaderHtml(orderDate)}
</td>
</tr>
<tr>
<td bgcolor="#04133b" align="center" style="background-color:#04133b; padding-top:40px; padding-bottom:40px; padding-left:28px; padding-right:28px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
<tr>
<td bgcolor="#ebb805" align="center" width="52" height="52" style="background-color:#ebb805; width:52px; height:52px; border-radius:26px; font-family:Arial,Helvetica,sans-serif; font-size:26px; line-height:52px; color:#04133b; font-weight:bold;">
&#10003;
</td>
</tr>
</table>
<p style="margin-top:24px; margin-bottom:0; font-family:Georgia,'Times New Roman',serif; font-size:30px; line-height:38px; color:#fbfaf7; font-weight:normal;">
Thank you &mdash; your order is in
</p>
<p style="margin-top:14px; margin-bottom:0; font-family:Arial,Helvetica,sans-serif; font-size:15px; line-height:23px; color:#c4cad6;">
Hi ${customerName} &mdash; payment came through and I&rsquo;ll start on it right away. This email is your receipt.
</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin-top:26px;">
<tr>
<td bgcolor="#1b2a4e" align="center" style="background-color:#1b2a4e; padding-top:12px; padding-bottom:12px; padding-left:22px; padding-right:22px; border-radius:6px;">
<span style="font-family:Arial,Helvetica,sans-serif; font-size:11px; line-height:16px; letter-spacing:2px; color:#9aa4ba;">CONFIRMATION</span>
<span style="font-family:Arial,Helvetica,sans-serif; font-size:15px; line-height:16px; letter-spacing:1px; color:#fbfaf7; font-weight:bold;">&nbsp;&nbsp;${orderNumber}</span>
</td>
</tr>
</table>
</td>
</tr>
<tr>
<td bgcolor="#ffffff" style="background-color:#ffffff; padding-top:28px; padding-bottom:8px; padding-left:28px; padding-right:28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#faf7f2" style="background-color:#faf7f2; border-radius:8px;">
<tr>
<td style="padding-top:14px; padding-bottom:14px; padding-left:20px; padding-right:20px; border-bottom:1px solid #e6e0d6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td align="left" style="font-family:Georgia,'Times New Roman',serif; font-size:17px; line-height:22px; color:#04133b;">Order summary</td>
<td align="right" style="font-family:Arial,Helvetica,sans-serif; font-size:13px; line-height:22px; color:#5a6377;">Placed ${orderDate}</td>
</tr>
</table>
</td>
</tr>
<tr>
<td style="padding-left:20px; padding-right:20px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${itemsHtml}
</table>
</td>
</tr>
<tr>
<td style="padding-top:14px; padding-bottom:16px; padding-left:20px; padding-right:20px; border-top:1px solid #e6e0d6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td align="left" style="font-family:Arial,Helvetica,sans-serif; font-size:14px; line-height:24px; color:#5a6377;">Subtotal</td>
<td align="right" style="font-family:Arial,Helvetica,sans-serif; font-size:14px; line-height:24px; color:#5a6377;">${subtotal}</td>
</tr>
<tr>
<td align="left" style="font-family:Arial,Helvetica,sans-serif; font-size:14px; line-height:24px; color:#5a6377;">Shipping</td>
<td align="right" style="font-family:Arial,Helvetica,sans-serif; font-size:14px; line-height:24px; color:#5a6377;">${shipping}</td>
</tr>
<tr>
<td align="left" style="font-family:Arial,Helvetica,sans-serif; font-size:14px; line-height:24px; color:#5a6377;">Tax</td>
<td align="right" style="font-family:Arial,Helvetica,sans-serif; font-size:14px; line-height:24px; color:#5a6377;">${tax}</td>
</tr>
<tr>
<td align="left" style="padding-top:10px; border-top:1px solid #e6e0d6; font-family:Arial,Helvetica,sans-serif; font-size:15px; line-height:26px; color:#04133b; font-weight:bold;">Total paid</td>
<td align="right" style="padding-top:10px; border-top:1px solid #e6e0d6; font-family:Georgia,'Times New Roman',serif; font-size:22px; line-height:26px; color:#04133b;">${total}</td>
</tr>
</table>
</td>
</tr>
</table>
</td>
</tr>
<tr>
<td bgcolor="#ffffff" style="background-color:#ffffff; padding-top:14px; padding-bottom:0; padding-left:28px; padding-right:28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e6e0d6; border-radius:8px;">
<tr>
<td style="padding-top:16px; padding-bottom:16px; padding-left:20px; padding-right:20px;">
<p style="margin-top:0; margin-bottom:8px; font-family:Arial,Helvetica,sans-serif; font-size:11px; line-height:16px; letter-spacing:2px; color:#5a6377; font-weight:bold;">SHIPPING TO</p>
${addressHtml}
</td>
</tr>
</table>
</td>
</tr>
<tr>
<td bgcolor="#ffffff" style="background-color:#ffffff; padding-top:12px; padding-bottom:0; padding-left:28px; padding-right:28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e6e0d6; border-radius:8px;">
<tr>
<td style="padding-top:16px; padding-bottom:16px; padding-left:20px; padding-right:20px;">
<p style="margin-top:0; margin-bottom:8px; font-family:Arial,Helvetica,sans-serif; font-size:11px; line-height:16px; letter-spacing:2px; color:#5a6377; font-weight:bold;">WHAT HAPPENS NEXT</p>
<p style="margin-top:0; margin-bottom:4px; font-family:Arial,Helvetica,sans-serif; font-size:14px; line-height:21px; color:#04133b; font-weight:bold;">${turnaroundNote}</p>
<p style="margin-top:0; margin-bottom:4px; font-family:Arial,Helvetica,sans-serif; font-size:14px; line-height:21px; color:#5a6377;">${shippingWindowNote}</p>
<p style="margin-top:0; margin-bottom:0; font-family:Arial,Helvetica,sans-serif; font-size:14px; line-height:21px; color:#5a6377;">${shippingMethod} &middot; tracking sent when it ships</p>
</td>
</tr>
</table>
</td>
</tr>
<tr>
<td bgcolor="#ffffff" align="center" style="background-color:#ffffff; padding-top:28px; padding-bottom:8px; padding-left:28px; padding-right:28px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
<tr>
<td bgcolor="#04133b" align="center" style="background-color:#04133b; border-radius:6px;">
<a href="${orderUrl}" style="display:block; padding-top:14px; padding-bottom:14px; padding-left:34px; padding-right:34px; font-family:Arial,Helvetica,sans-serif; font-size:15px; line-height:20px; color:#fbfaf7; font-weight:bold; text-decoration:none;">Track this order &rarr;</a>
</td>
</tr>
</table>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin-top:12px;">
<tr>
<td bgcolor="#ffffff" align="center" style="background-color:#ffffff; border:1px solid #04133b; border-radius:6px;">
<a href="${shopUrl}" style="display:block; padding-top:13px; padding-bottom:13px; padding-left:34px; padding-right:34px; font-family:Arial,Helvetica,sans-serif; font-size:15px; line-height:20px; color:#04133b; font-weight:bold; text-decoration:none;">Keep shopping</a>
</td>
</tr>
</table>
</td>
</tr>
<tr>
<td bgcolor="#ffffff" align="center" style="background-color:#ffffff; padding-top:22px; padding-bottom:30px; padding-left:40px; padding-right:40px;">
<p style="margin:0; font-family:Arial,Helvetica,sans-serif; font-size:13px; line-height:20px; color:#5a6377;">
Need to change something? Reply to this email within 24 hours and I&rsquo;ll catch it before production.
</p>
</td>
</tr>
<tr>
<td bgcolor="#04133b" style="background-color:#04133b; padding-top:26px; padding-bottom:26px; padding-left:28px; padding-right:28px; border-bottom-left-radius:10px; border-bottom-right-radius:10px;">
${brandFooterWordmarkHtml()}
<p style="margin-top:0; margin-bottom:14px; font-family:Arial,Helvetica,sans-serif; font-size:13px; line-height:20px; color:#c4cad6;">
Handmade &amp; custom stickers, shirts, keychains, cups and banners &mdash; made one order at a time.
</p>
<p style="margin-top:0; margin-bottom:4px; font-family:Arial,Helvetica,sans-serif; font-size:12px; line-height:18px; color:#8d97ac;">${shopAddress}</p>
<p style="margin-top:0; margin-bottom:0; font-family:Arial,Helvetica,sans-serif; font-size:12px; line-height:18px; color:#8d97ac;">
You&rsquo;re getting this because you placed an order.
</p>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;

  const text = `${SITE_NAME} — ${SITE_TAGLINE}

THANK YOU — YOUR ORDER IS IN

Hi ${customerFirstName(order)} — payment came through and I'll start on it right away. This email is your receipt.

Confirmation ${orderNumber}
Placed ${formatOrderDate(order.placedAt)}

ORDER SUMMARY
-------------
${itemsText}
-------------
Subtotal: ${subtotal}
Shipping: ${shipping}
Tax: ${tax}
Total paid: ${total}

SHIPPING TO
${addressText}

WHAT HAPPENS NEXT
${notes.turnaroundNote}
${notes.shippingWindowNote}
${order.shippingMethodName ?? "Standard shipping"} · tracking sent when it ships

View your order: ${orderUrl}
Keep shopping: ${shopUrl}

Need to change something? Reply to this email within 24 hours and I'll catch it before production.

--
${process.env.SHOP_POSTAL_ADDRESS ?? SITE_NAME}
You're getting this because you placed an order.`;

  return {
    subject: `Order ${orderNumber} is confirmed — ${SITE_NAME}`,
    html,
    text,
  };
}

export type ShipmentDetails = {
  carrierName: string;
  trackingNumber: string;
  trackingUrl: string;
  shipDate: string;
};

export function orderShippedContent(
  order: OrderConfirmation,
  shipment: ShipmentDetails,
): OrderEmailContent {
  const orderUrl = orderConfirmationUrl(order);
  const shopUrl = `${storefrontUrl()}/products`;
  const trackingUrl = shipment.trackingUrl || orderUrl;
  const { currencyCode } = order.totals;
  const orderNumber = orderReference(order.displayId);
  const shipDate = escapeHtml(shipment.shipDate);
  const customerName = escapeHtml(customerFirstName(order));
  const carrierName = escapeHtml(shipment.carrierName);
  const trackingNumber = escapeHtml(shipment.trackingNumber);
  const shopAddress = escapeHtml(process.env.SHOP_POSTAL_ADDRESS ?? SITE_NAME);
  const itemsHtml = renderOrderItemsHtml(order.lines, currencyCode, orderUrl);
  const itemsText = renderOrderItemsText(order.lines, currencyCode);
  const addressHtml = renderAddressHtml(order.shippingAddress);
  const addressText = renderAddressText(order.shippingAddress);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Your order is on its way</title>
${BRAND_FONT_LINK}
</head>
<body style="margin:0; padding:0; background-color:#ecebe6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ecebe6" style="background-color:#ecebe6;">
<tr>
<td align="center" style="padding-top:32px; padding-bottom:32px; padding-left:12px; padding-right:12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px;">
<tr>
<td bgcolor="#ffffff" style="background-color:#ffffff; padding-top:20px; padding-bottom:20px; padding-left:28px; padding-right:28px; border-top-left-radius:10px; border-top-right-radius:10px;">
${brandHeaderHtml(shipDate)}
</td>
</tr>
<tr>
<td bgcolor="#04133b" align="center" style="background-color:#04133b; padding-top:40px; padding-bottom:40px; padding-left:28px; padding-right:28px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
<tr>
<td bgcolor="#ebb805" align="center" width="52" height="52" style="background-color:#ebb805; width:52px; height:52px; border-radius:26px; font-family:Arial,Helvetica,sans-serif; font-size:26px; line-height:52px; color:#04133b; font-weight:bold;">
&rarr;
</td>
</tr>
</table>
<p style="margin-top:24px; margin-bottom:0; font-family:Georgia,'Times New Roman',serif; font-size:30px; line-height:38px; color:#fbfaf7; font-weight:normal;">
It&rsquo;s on its way
</p>
<p style="margin-top:14px; margin-bottom:0; font-family:Arial,Helvetica,sans-serif; font-size:15px; line-height:23px; color:#c4cad6;">
Hi ${customerName} &mdash; your order left the workshop. Here&rsquo;s what&rsquo;s in the box.
</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin-top:26px;">
<tr>
<td bgcolor="#1b2a4e" align="center" style="background-color:#1b2a4e; padding-top:12px; padding-bottom:12px; padding-left:22px; padding-right:22px; border-radius:6px;">
<span style="font-family:Arial,Helvetica,sans-serif; font-size:11px; line-height:16px; letter-spacing:2px; color:#9aa4ba;">CONFIRMATION</span>
<span style="font-family:Arial,Helvetica,sans-serif; font-size:15px; line-height:16px; letter-spacing:1px; color:#fbfaf7; font-weight:bold;">&nbsp;&nbsp;${orderNumber}</span>
</td>
</tr>
</table>
</td>
</tr>
<tr>
<td bgcolor="#ffffff" style="background-color:#ffffff; padding-top:28px; padding-bottom:8px; padding-left:28px; padding-right:28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#faf7f2" style="background-color:#faf7f2; border-radius:8px;">
<tr>
<td style="padding-top:14px; padding-bottom:14px; padding-left:20px; padding-right:20px; border-bottom:1px solid #e6e0d6; font-family:Georgia,'Times New Roman',serif; font-size:17px; line-height:22px; color:#04133b;">
In this shipment
</td>
</tr>
<tr>
<td style="padding-left:20px; padding-right:20px; padding-bottom:6px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${itemsHtml}
</table>
</td>
</tr>
</table>
</td>
</tr>
<tr>
<td bgcolor="#ffffff" style="background-color:#ffffff; padding-top:14px; padding-bottom:0; padding-left:28px; padding-right:28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e6e0d6; border-radius:8px;">
<tr>
<td style="padding-top:16px; padding-bottom:16px; padding-left:20px; padding-right:20px;">
<p style="margin-top:0; margin-bottom:8px; font-family:Arial,Helvetica,sans-serif; font-size:11px; line-height:16px; letter-spacing:2px; color:#5a6377; font-weight:bold;">TRACKING</p>
<p style="margin-top:0; margin-bottom:4px; font-family:Arial,Helvetica,sans-serif; font-size:14px; line-height:21px; color:#04133b; font-weight:bold;">${carrierName}</p>
<p style="margin-top:0; margin-bottom:0; font-family:Arial,Helvetica,sans-serif; font-size:14px; line-height:21px; color:#5a6377;">${trackingNumber}</p>
</td>
</tr>
</table>
</td>
</tr>
<tr>
<td bgcolor="#ffffff" style="background-color:#ffffff; padding-top:12px; padding-bottom:0; padding-left:28px; padding-right:28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e6e0d6; border-radius:8px;">
<tr>
<td style="padding-top:16px; padding-bottom:16px; padding-left:20px; padding-right:20px;">
<p style="margin-top:0; margin-bottom:8px; font-family:Arial,Helvetica,sans-serif; font-size:11px; line-height:16px; letter-spacing:2px; color:#5a6377; font-weight:bold;">SHIPPING TO</p>
${addressHtml}
</td>
</tr>
</table>
</td>
</tr>
<tr>
<td bgcolor="#ffffff" align="center" style="background-color:#ffffff; padding-top:28px; padding-bottom:8px; padding-left:28px; padding-right:28px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
<tr>
<td bgcolor="#04133b" align="center" style="background-color:#04133b; border-radius:6px;">
<a href="${trackingUrl}" style="display:block; padding-top:14px; padding-bottom:14px; padding-left:34px; padding-right:34px; font-family:Arial,Helvetica,sans-serif; font-size:15px; line-height:20px; color:#fbfaf7; font-weight:bold; text-decoration:none;">Track this shipment &rarr;</a>
</td>
</tr>
</table>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin-top:12px;">
<tr>
<td bgcolor="#ffffff" align="center" style="background-color:#ffffff; border:1px solid #04133b; border-radius:6px;">
<a href="${orderUrl}" style="display:block; padding-top:13px; padding-bottom:13px; padding-left:34px; padding-right:34px; font-family:Arial,Helvetica,sans-serif; font-size:15px; line-height:20px; color:#04133b; font-weight:bold; text-decoration:none;">View your order</a>
</td>
</tr>
</table>
</td>
</tr>
<tr>
<td bgcolor="#ffffff" align="center" style="background-color:#ffffff; padding-top:22px; padding-bottom:30px; padding-left:40px; padding-right:40px;">
<p style="margin:0; font-family:Arial,Helvetica,sans-serif; font-size:13px; line-height:20px; color:#5a6377;">
Tracking can take a few hours to start updating after the label is scanned. If it still looks stuck tomorrow, just reply and I&rsquo;ll chase it.
</p>
</td>
</tr>
<tr>
<td bgcolor="#04133b" style="background-color:#04133b; padding-top:26px; padding-bottom:26px; padding-left:28px; padding-right:28px; border-bottom-left-radius:10px; border-bottom-right-radius:10px;">
${brandFooterWordmarkHtml()}
<p style="margin-top:0; margin-bottom:14px; font-family:Arial,Helvetica,sans-serif; font-size:13px; line-height:20px; color:#c4cad6;">
Handmade &amp; custom stickers, shirts, keychains, cups and banners &mdash; made one order at a time.
</p>
<p style="margin-top:0; margin-bottom:4px; font-family:Arial,Helvetica,sans-serif; font-size:12px; line-height:18px; color:#8d97ac;">${shopAddress}</p>
<p style="margin-top:0; margin-bottom:0; font-family:Arial,Helvetica,sans-serif; font-size:12px; line-height:18px; color:#8d97ac;">
You&rsquo;re getting this because you placed an order.
</p>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;

  const text = `${SITE_NAME} — ${SITE_TAGLINE}

IT'S ON ITS WAY

Hi ${customerFirstName(order)} — your order left the workshop${shipment.shipDate ? ` ${shipment.shipDate}` : ""}. Here's what's in the box.

Confirmation ${orderNumber}

IN THIS SHIPMENT
-------------
${itemsText}
-------------

TRACKING
Carrier: ${shipment.carrierName}
Tracking number: ${shipment.trackingNumber}
Track it: ${trackingUrl}

SHIPPING TO
${addressText}

View your order: ${orderUrl}
Keep shopping: ${shopUrl}

Tracking can take a few hours to start updating after the label is scanned. If it still looks stuck tomorrow, just reply and I'll chase it.

--
${process.env.SHOP_POSTAL_ADDRESS ?? SITE_NAME}
You're getting this because you placed an order.`;

  return {
    subject: `Order ${orderNumber} is on its way — ${SITE_NAME}`,
    html,
    text,
  };
}
