import type { ShippingRate } from "@craftynp/types";

import type { Cart } from "@/lib/cart";
import { EMPTY_CHECKOUT_DRAFT, type CheckoutDraft } from "@/lib/checkout";
import {
  cheapestRateId,
  formatDeliveryWindow,
  isDestinationReadyForRates,
  selectedShippingAmount,
  shippingRateKey,
} from "@/lib/shipping-rates";

function makeDraft(overrides: Partial<CheckoutDraft> = {}): CheckoutDraft {
  return {
    ...EMPTY_CHECKOUT_DRAFT,
    firstName: "Jamie",
    lastName: "Rivera",
    email: "jamie@example.com",
    phone: "555-123-4567",
    address1: "123 Maple Street",
    city: "Springfield",
    state: "IL",
    postalCode: "62704",
    countryCode: "us",
    ...overrides,
  };
}

function makeCart(overrides: Partial<Cart> = {}): Cart {
  return { lines: [], ...overrides };
}

function makeRate(overrides: Partial<ShippingRate> = {}): ShippingRate {
  return {
    rateId: "rate_1",
    carrierName: "USPS",
    serviceName: "USPS Ground Advantage",
    serviceCode: "usps_ground_advantage",
    amount: 7.42,
    currencyCode: "usd",
    deliveryDays: 4,
    estimatedDeliveryDate: null,
    quoteToken: "token",
    ...overrides,
  };
}

describe("isDestinationReadyForRates", () => {
  it("is true once city, state, postal code, and country are all valid", () => {
    expect(isDestinationReadyForRates(makeDraft())).toBe(true);
  });

  it("is false when the city is blank", () => {
    expect(isDestinationReadyForRates(makeDraft({ city: "" }))).toBe(false);
  });

  it("is false when the postal code is a 4-digit ZIP", () => {
    expect(isDestinationReadyForRates(makeDraft({ postalCode: "1234" }))).toBe(
      false,
    );
  });

  it("is false when the state is blank", () => {
    expect(isDestinationReadyForRates(makeDraft({ state: "" }))).toBe(false);
  });

  it("is true even when the shipping rate has not been chosen yet", () => {
    expect(isDestinationReadyForRates(makeDraft({ shippingRateId: "" }))).toBe(
      true,
    );
  });

  it("is true even when unrelated fields (email, phone) are blank", () => {
    expect(
      isDestinationReadyForRates(makeDraft({ email: "", phone: "" })),
    ).toBe(true);
  });
});

describe("shippingRateKey", () => {
  it("combines destination and sorted cart lines", () => {
    const draft = makeDraft();
    const cart = makeCart({
      lines: [
        {
          id: "b",
          href: "/b",
          title: "B",
          unitPrice: 1,
          currencyCode: "usd",
          quantity: 2,
        },
        {
          id: "a",
          href: "/a",
          title: "A",
          unitPrice: 1,
          currencyCode: "usd",
          quantity: 1,
        },
      ],
    });

    expect(shippingRateKey(draft, cart)).toBe("us|62704|a:1,b:2");
  });

  it("is stable regardless of cart line order", () => {
    const draft = makeDraft();
    const cartA = makeCart({
      lines: [
        {
          id: "a",
          href: "/a",
          title: "A",
          unitPrice: 1,
          currencyCode: "usd",
          quantity: 1,
        },
        {
          id: "b",
          href: "/b",
          title: "B",
          unitPrice: 1,
          currencyCode: "usd",
          quantity: 2,
        },
      ],
    });
    const cartB = makeCart({
      lines: [
        {
          id: "b",
          href: "/b",
          title: "B",
          unitPrice: 1,
          currencyCode: "usd",
          quantity: 2,
        },
        {
          id: "a",
          href: "/a",
          title: "A",
          unitPrice: 1,
          currencyCode: "usd",
          quantity: 1,
        },
      ],
    });

    expect(shippingRateKey(draft, cartA)).toBe(shippingRateKey(draft, cartB));
  });

  it("changes when the postal code changes", () => {
    const cart = makeCart();
    expect(shippingRateKey(makeDraft(), cart)).not.toBe(
      shippingRateKey(makeDraft({ postalCode: "95128" }), cart),
    );
  });
});

describe("cheapestRateId", () => {
  it("returns null for an empty list", () => {
    expect(cheapestRateId([])).toBeNull();
  });

  it("returns the id of the lowest-amount rate", () => {
    const rates = [
      makeRate({ rateId: "expensive", amount: 20 }),
      makeRate({ rateId: "cheap", amount: 5 }),
    ];
    expect(cheapestRateId(rates)).toBe("cheap");
  });

  it("breaks ties by returning the first match", () => {
    const rates = [
      makeRate({ rateId: "first", amount: 10 }),
      makeRate({ rateId: "second", amount: 10 }),
    ];
    expect(cheapestRateId(rates)).toBe("first");
  });
});

describe("selectedShippingAmount", () => {
  it("returns the amount for the matching rate id", () => {
    const rates = [makeRate({ rateId: "rate_1", amount: 7.42 })];
    expect(selectedShippingAmount(rates, "rate_1")).toBe(7.42);
  });

  it("returns null when no rate matches", () => {
    expect(selectedShippingAmount([], "rate_1")).toBeNull();
  });
});

describe("formatDeliveryWindow", () => {
  it("formats a single business day", () => {
    expect(formatDeliveryWindow(makeRate({ deliveryDays: 1 }))).toBe(
      "Arrives in 1 business day",
    );
  });

  it("formats multiple business days", () => {
    expect(formatDeliveryWindow(makeRate({ deliveryDays: 4 }))).toBe(
      "Arrives in 4 business days",
    );
  });

  it("falls back to the estimated delivery date when deliveryDays is null", () => {
    const result = formatDeliveryWindow(
      makeRate({ deliveryDays: null, estimatedDeliveryDate: "2026-08-04" }),
    );
    expect(result).toMatch(/^Arrives /);
  });

  it("reports an unavailable estimate when nothing is known", () => {
    expect(
      formatDeliveryWindow(
        makeRate({ deliveryDays: null, estimatedDeliveryDate: null }),
      ),
    ).toBe("Delivery estimate unavailable");
  });
});
