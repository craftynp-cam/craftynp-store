import type { OrderConfirmation } from "@craftynp/types";

import { orderConfirmationContent, orderShippedContent } from "./order-email";

const ORDER: OrderConfirmation = {
  orderId: "order_01",
  displayId: 9,
  email: "jamie@example.com",
  placedAt: "2026-07-31T04:01:16.235Z",
  status: "pending",
  fulfilmentStatus: "received",
  tracking: null,
  shippingMethodName: "Live USPS Rate",
  lines: [
    {
      id: "item_1",
      title: "Medusa Shorts",
      variantTitle: "L",
      thumbnail: null,
      quantity: 1,
      unitPrice: 20.75,
      lineTotal: 20.75,
      isCustomizable: false,
      details: [],
    },
  ],
  totals: {
    subtotal: 15,
    shipping: 4.39,
    tax: 1.36,
    total: 20.75,
    currencyCode: "usd",
  },
  shippingAddress: {
    firstName: "Cameron",
    lastName: "Test",
    phone: null,
    address1: "123 Maple Street",
    address2: "",
    city: "Indianapolis",
    state: "IN",
    postalCode: "46239",
    countryCode: "us",
  },
  isGuest: false,
};

const NOTES = {
  turnaroundNote: "Made to order in 3–5 business days.",
  shippingWindowNote: "Delivery takes another 2–5 business days.",
};

beforeEach(() => {
  process.env.STOREFRONT_URL = "https://thecraftynp.org";
});

describe("orderConfirmationContent", () => {
  it("embeds the real order data directly, not a Resend template variable", () => {
    // Resend's REST API silently fell back to a template's *declared default*
    // for every variable when this went through template.id + variables —
    // #CNP-0000 / $0.00 across the board. Nothing here should ever produce
    // that shape again, because there is no variable substitution left to fail.
    const { subject, html, text } = orderConfirmationContent(ORDER, NOTES);

    expect(subject).toBe("Your Crafty NP order #CNP-9 is confirmed");
    expect(html).toContain("#CNP-9");
    expect(html).toContain("$20.75");
    expect(html).not.toContain("#CNP-0000");
    expect(html).not.toContain("$0.00");
    expect(text).toContain("#CNP-9");
    expect(text).toContain("$20.75");
  });

  it("points the order link at the real tokenized URL, not the storefront root", () => {
    const { html } = orderConfirmationContent(ORDER, NOTES);

    expect(html).toContain(
      "https://thecraftynp.org/checkout/confirmation?order=order_01",
    );
    expect(html).not.toMatch(/href="https:\/\/thecraftynp\.org"/);
  });

  it("escapes a shopper-supplied name before it reaches the HTML body", () => {
    const order: OrderConfirmation = {
      ...ORDER,
      shippingAddress: {
        ...ORDER.shippingAddress!,
        firstName: "<img src=x onerror=alert(1)>",
      },
    };

    const { html } = orderConfirmationContent(order, NOTES);

    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x");
  });

  it("carries the turnaround and shipping-window notes through", () => {
    const { html, text } = orderConfirmationContent(ORDER, NOTES);

    expect(html).toContain(NOTES.turnaroundNote);
    expect(text).toContain(NOTES.turnaroundNote);
  });
});

describe("orderShippedContent", () => {
  const SHIPMENT = {
    carrierName: "USPS",
    trackingNumber: "9400111899223197428490",
    trackingUrl: "https://tools.usps.com/go/TrackConfirmAction?tLabels=9400",
    shipDate: "Aug 1, 2026",
  };

  it("embeds the real tracking details, not a template default", () => {
    const { subject, html } = orderShippedContent(ORDER, SHIPMENT);

    expect(subject).toBe("Your Crafty NP order #CNP-9 is on its way");
    expect(html).toContain("9400111899223197428490");
    expect(html).toContain(SHIPMENT.trackingUrl);
    expect(html).not.toContain("the carrier");
  });

  it("falls back to the order's own link when no carrier tracking URL exists", () => {
    const { html } = orderShippedContent(ORDER, {
      ...SHIPMENT,
      trackingUrl: "",
    });

    expect(html).toContain(
      'href="https://thecraftynp.org/checkout/confirmation?order=order_01',
    );
  });
});
