import { render, screen } from "@testing-library/react";

import type { OrderTracking } from "@craftynp/types";

import { OrderTrackingCard } from "@/components";

const TRACKING_NUMBER = "9400111899223197428490";

function tracking(overrides: Partial<OrderTracking> = {}): OrderTracking {
  return {
    trackingNumber: TRACKING_NUMBER,
    trackingUrl: `https://tools.usps.com/go/TrackConfirmAction?tLabels=${TRACKING_NUMBER}`,
    carrierCode: "usps",
    carrierName: "usps",
    status: "in_transit",
    statusDescription: null,
    shippedAt: "2026-07-30T12:00:00.000Z",
    deliveredAt: null,
    ...overrides,
  };
}

describe("OrderTrackingCard", () => {
  it("links the tracking number to the carrier when a link is available", () => {
    render(<OrderTrackingCard status="shipped" tracking={tracking()} />);

    const link = screen.getByRole("link", { name: TRACKING_NUMBER });
    expect(link).toHaveAttribute(
      "href",
      expect.stringContaining("tools.usps.com"),
    );
  });

  it("shows the bare number when the carrier has no tracking page", () => {
    render(
      <OrderTrackingCard
        status="shipped"
        tracking={tracking({ trackingUrl: null, carrierCode: "royal_mail" })}
      />,
    );

    expect(screen.getByText(TRACKING_NUMBER)).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("says a shipped order has no tracking yet rather than showing a dead link", () => {
    render(<OrderTrackingCard status="shipped" tracking={null} />);

    expect(
      screen.getByText(/tracking number will appear here/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("prefers the carrier's own wording over our fallback copy", () => {
    render(
      <OrderTrackingCard
        status="shipped"
        tracking={tracking({ statusDescription: "Arrived at facility" })}
      />,
    );

    expect(screen.getByText("Arrived at facility")).toBeInTheDocument();
  });

  it("falls back to our wording when the carrier sends none", () => {
    render(
      <OrderTrackingCard
        status="shipped"
        tracking={tracking({ status: "out_for_delivery" })}
      />,
    );

    expect(screen.getByText("Out for delivery")).toBeInTheDocument();
  });

  it("stays out of the way until the order has actually shipped", () => {
    const { container } = render(
      <OrderTrackingCard status="packing" tracking={null} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
