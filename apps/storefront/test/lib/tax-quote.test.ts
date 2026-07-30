import type { Cart } from "@/lib/cart";
import { EMPTY_CHECKOUT_DRAFT, type CheckoutDraft } from "@/lib/checkout";
import { isDestinationReadyForTax, taxQuoteKey } from "@/lib/tax-quote";

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
    ...overrides,
  };
}

function makeCart(overrides: Partial<Cart> = {}): Cart {
  return { lines: [], ...overrides };
}

describe("isDestinationReadyForTax", () => {
  it("is true once the address is valid and a shipping rate is chosen", () => {
    expect(isDestinationReadyForTax(makeDraft())).toBe(true);
  });

  it("is false when no shipping rate has been chosen yet", () => {
    expect(isDestinationReadyForTax(makeDraft({ shippingRateId: "" }))).toBe(
      false,
    );
  });

  it("is false when the city is blank", () => {
    expect(isDestinationReadyForTax(makeDraft({ city: "" }))).toBe(false);
  });

  it("is false when the postal code is a 4-digit ZIP", () => {
    expect(isDestinationReadyForTax(makeDraft({ postalCode: "1234" }))).toBe(
      false,
    );
  });

  it("is true even when unrelated fields (email, phone) are blank", () => {
    expect(
      isDestinationReadyForTax(makeDraft({ email: "", phone: "" })),
    ).toBe(true);
  });
});

describe("taxQuoteKey", () => {
  it("combines destination, shipping rate, and sorted cart lines", () => {
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

    expect(taxQuoteKey(draft, cart)).toBe("us|62704|il|springfield|rate_1|a:1,b:2");
  });

  it("changes when the shipping rate changes", () => {
    const cart = makeCart();
    expect(taxQuoteKey(makeDraft(), cart)).not.toBe(
      taxQuoteKey(makeDraft({ shippingRateId: "rate_2" }), cart),
    );
  });

  it("changes when the state changes", () => {
    const cart = makeCart();
    expect(taxQuoteKey(makeDraft(), cart)).not.toBe(
      taxQuoteKey(makeDraft({ state: "CA" }), cart),
    );
  });
});
