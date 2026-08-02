import { render, screen } from "@testing-library/react";

import type { OrderConfirmation } from "@craftynp/types";

import { OrderConfirmationView } from "@/components";

const ORDER: OrderConfirmation = {
  orderId: "order_01",
  displayId: 2853,
  email: "jamie.rivera@email.com",
  placedAt: "2026-07-30T12:00:00.000Z",
  status: "pending",
  fulfilmentStatus: "received",
  tracking: null,
  shippingMethodName: "Standard shipping",
  lines: [
    {
      id: "item_1",
      title: "Custom Die-Cut Stickers",
      variantTitle: null,
      thumbnail: null,
      quantity: 50,
      unitPrice: 0.75,
      lineTotal: 37.5,
      isCustomizable: true,
      details: [{ label: "Text", value: "The Crafty NP" }],
    },
  ],
  totals: {
    subtotal: 55.5,
    shipping: 6,
    tax: 4.44,
    total: 65.94,
    currencyCode: "usd",
  },
  shippingAddress: {
    firstName: "Jamie",
    lastName: "Rivera",
    phone: null,
    address1: "123 Maple Street",
    address2: "Apt 4B",
    city: "Springfield",
    state: "IL",
    postalCode: "62704",
    countryCode: "us",
  },
  isGuest: true,
};

function renderView(
  overrides: Partial<React.ComponentProps<typeof OrderConfirmationView>> = {},
) {
  return render(
    <OrderConfirmationView
      order={ORDER}
      fallbackDisplayId="2853"
      turnaroundNote="Made to order in 3–5 business days."
      shippingWindowNote="Delivery takes another 2–5 business days."
      isSignedIn={false}
      returnTo="/checkout/confirmation?order=order_01"
      {...overrides}
    />,
  );
}

describe("OrderConfirmationView", () => {
  it("offers account creation to a guest", () => {
    renderView();

    expect(
      screen.getByRole("link", { name: "Create an account" }),
    ).toBeInTheDocument();
  });

  it("does not offer account creation to a signed-in customer", () => {
    renderView({ isSignedIn: true });

    expect(
      screen.queryByRole("link", { name: "Create an account" }),
    ).not.toBeInTheDocument();
  });

  it("promises a proof when the order includes a custom item", () => {
    renderView();

    expect(screen.getByText(/digital\s+proof/)).toBeInTheDocument();
  });

  it("omits the proof note when nothing in the order is customizable", () => {
    renderView({
      order: {
        ...ORDER,
        lines: [{ ...ORDER.lines[0]!, isCustomizable: false }],
      },
    });

    expect(screen.queryByText(/digital\s+proof/)).not.toBeInTheDocument();
  });

  it("still thanks the shopper when the order could not be loaded", () => {
    renderView({ order: null });

    expect(
      screen.getByRole("heading", { name: /Thank you/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("#CNP-2853")).toBeInTheDocument();
  });
});
