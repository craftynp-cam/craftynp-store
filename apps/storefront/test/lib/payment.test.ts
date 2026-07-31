import type { Cart } from "@/lib/cart";
import { EMPTY_CHECKOUT_DRAFT, type CheckoutDraft } from "@/lib/checkout";
import { isReadyForPayment, paymentPrepareKey } from "@/lib/payment";

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
    shippingRateId: "rate_1",
    shippingServiceCode: "usps_ground_advantage",
    shippingQuoteToken: "shipping.token",
    taxQuoteToken: "tax.token",
    ...overrides,
  };
}

function makeCart(overrides: Partial<Cart> = {}): Cart {
  return { lines: [], ...overrides };
}

describe("isReadyForPayment", () => {
  it("is true once the draft is fully valid and tax is ready", () => {
    expect(isReadyForPayment(makeDraft(), true)).toBe(true);
  });

  it("is false while tax is not ready yet, even if the draft still holds a stale tax token", () => {
    // Same staleness class isDestinationReadyForTax guards against: the
    // draft can carry a tax token from a previous address for a moment
    // after an edit, until the live tax hook settles a fresh one.
    expect(isReadyForPayment(makeDraft(), false)).toBe(false);
  });

  it("is false when the tax quote token is blank", () => {
    expect(isReadyForPayment(makeDraft({ taxQuoteToken: "" }), true)).toBe(
      false,
    );
  });

  it("is false when the draft has a validation error", () => {
    expect(isReadyForPayment(makeDraft({ email: "" }), true)).toBe(false);
  });

  it("is false when billing address fields are invalid", () => {
    const draft = makeDraft({
      billingSameAsDelivery: false,
      billingAddress1: "",
    });
    expect(isReadyForPayment(draft, true)).toBe(false);
  });
});

describe("paymentPrepareKey", () => {
  it("combines the tax quote token, email, billing address, and sorted cart lines", () => {
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

    expect(paymentPrepareKey(draft, cart)).toBe(
      "tax.token|jamie@example.com|Jamie:Rivera:555-123-4567:123 Maple Street:|same|a:1,b:2",
    );
  });

  it("changes when the tax quote token changes", () => {
    const cart = makeCart();
    expect(paymentPrepareKey(makeDraft(), cart)).not.toBe(
      paymentPrepareKey(makeDraft({ taxQuoteToken: "tax.token.2" }), cart),
    );
  });

  it("changes when only the street address is edited", () => {
    // The tax quote token covers postal code, country, state and city, but not
    // the street lines — leave them out of the key and a street-only edit never
    // re-prepares, so the Medusa cart keeps the previous address on the order.
    const cart = makeCart();
    expect(paymentPrepareKey(makeDraft(), cart)).not.toBe(
      paymentPrepareKey(makeDraft({ address1: "456 Oak Avenue" }), cart),
    );
  });

  it("changes when the apartment line is added", () => {
    const cart = makeCart();
    expect(paymentPrepareKey(makeDraft(), cart)).not.toBe(
      paymentPrepareKey(makeDraft({ address2: "Apt 4B" }), cart),
    );
  });

  it("changes when the recipient name is edited", () => {
    const cart = makeCart();
    expect(paymentPrepareKey(makeDraft(), cart)).not.toBe(
      paymentPrepareKey(makeDraft({ lastName: "Rivera-Smith" }), cart),
    );
  });

  it("changes when a separate billing address is entered", () => {
    const cart = makeCart();
    const withBilling = makeDraft({
      billingSameAsDelivery: false,
      billingAddress1: "456 Oak Ave",
      billingCity: "Springfield",
      billingState: "IL",
      billingPostalCode: "62704",
      billingCountryCode: "us",
    });
    expect(paymentPrepareKey(makeDraft(), cart)).not.toBe(
      paymentPrepareKey(withBilling, cart),
    );
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
    const cartB = makeCart({ lines: [...cartA.lines].reverse() });

    expect(paymentPrepareKey(draft, cartA)).toBe(
      paymentPrepareKey(draft, cartB),
    );
  });
});
