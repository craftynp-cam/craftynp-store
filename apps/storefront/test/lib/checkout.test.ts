import {
  checkoutTotals,
  type CheckoutDraft,
  countryOptions,
  EMPTY_CHECKOUT_DRAFT,
  isCheckoutDraftValid,
  prefillCheckoutDraft,
  validateCheckoutDraft,
} from "@/lib/checkout";
import type { Cart } from "@/lib/cart";
import type { RegionSource } from "@/lib/region";

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

describe("EMPTY_CHECKOUT_DRAFT", () => {
  it("defaults to a US address and matching billing", () => {
    expect(EMPTY_CHECKOUT_DRAFT.countryCode).toBe("us");
    expect(EMPTY_CHECKOUT_DRAFT.billingSameAsDelivery).toBe(true);
  });
});

describe("validateCheckoutDraft", () => {
  it("reports a message for every required field on an empty draft", () => {
    const errors = validateCheckoutDraft(EMPTY_CHECKOUT_DRAFT);

    expect(errors).toEqual({
      firstName: "Enter your first name.",
      lastName: "Enter your last name.",
      email: "Enter your email address.",
      phone: "Enter a phone number for delivery updates.",
      address1: "Enter your street address.",
      city: "Enter your city.",
      state: "Enter your state.",
      postalCode: "Enter your ZIP code.",
    });
  });

  it("requires a country to be chosen", () => {
    const errors = validateCheckoutDraft(makeDraft({ countryCode: "" }));
    expect(errors.countryCode).toBe("Choose a country.");
  });

  it("never errors on the optional apartment/suite field", () => {
    expect(validateCheckoutDraft(EMPTY_CHECKOUT_DRAFT)).not.toHaveProperty(
      "address2",
    );
  });

  it("treats whitespace-only values as blank", () => {
    const errors = validateCheckoutDraft(makeDraft({ firstName: "   " }));
    expect(errors.firstName).toBe("Enter your first name.");
  });

  it("gives a different message for a malformed email than a blank one", () => {
    const blank = validateCheckoutDraft(makeDraft({ email: "" }));
    const malformed = validateCheckoutDraft(
      makeDraft({ email: "not-an-email" }),
    );

    expect(blank.email).toBe("Enter your email address.");
    expect(malformed.email).toBe(
      "Enter an email address like name@example.com.",
    );
  });

  it("accepts a well-formed email", () => {
    expect(validateCheckoutDraft(makeDraft()).email).toBeUndefined();
  });

  it("requires at least 10 digits in the phone number", () => {
    const errors = validateCheckoutDraft(makeDraft({ phone: "555-1234" }));
    expect(errors.phone).toBe("Enter a phone number with at least 10 digits.");
  });

  it("accepts a phone number with punctuation once it has 10 digits", () => {
    expect(
      validateCheckoutDraft(makeDraft({ phone: "(555) 123-4567" })).phone,
    ).toBeUndefined();
  });

  it("requires a 5-digit ZIP code for a US address", () => {
    const errors = validateCheckoutDraft(makeDraft({ postalCode: "9720" }));
    expect(errors.postalCode).toBe("Enter a 5-digit ZIP code, like 12345.");
  });

  it("accepts a ZIP+4 code", () => {
    expect(
      validateCheckoutDraft(makeDraft({ postalCode: "62704-1234" })).postalCode,
    ).toBeUndefined();
  });

  it("does not apply the US ZIP pattern to non-US addresses", () => {
    const errors = validateCheckoutDraft(
      makeDraft({ countryCode: "gb", postalCode: "SW1A 1AA" }),
    );
    expect(errors.postalCode).toBeUndefined();
  });

  it("uses postal-code wording for a blank non-US address", () => {
    const errors = validateCheckoutDraft(
      makeDraft({ countryCode: "gb", postalCode: "" }),
    );
    expect(errors.postalCode).toBe("Enter your postal code.");
  });

  it("reports no errors for a fully valid draft", () => {
    expect(validateCheckoutDraft(makeDraft())).toEqual({});
  });

  it("skips billing validation while billingSameAsDelivery is true", () => {
    const errors = validateCheckoutDraft(
      makeDraft({ billingSameAsDelivery: true, billingAddress1: "" }),
    );
    expect(errors.billingAddress1).toBeUndefined();
  });

  it("requires billing fields once billingSameAsDelivery is false", () => {
    const errors = validateCheckoutDraft(
      makeDraft({ billingSameAsDelivery: false }),
    );

    expect(errors).toEqual({
      billingAddress1: "Enter the billing street address.",
      billingCity: "Enter the billing city.",
      billingState: "Enter the billing state.",
      billingPostalCode: "Enter the billing ZIP code.",
    });
  });

  it("requires a 5-digit billing ZIP code for a US billing address", () => {
    const errors = validateCheckoutDraft(
      makeDraft({
        billingSameAsDelivery: false,
        billingAddress1: "1 Elm St",
        billingCity: "Portland",
        billingState: "OR",
        billingPostalCode: "9720",
        billingCountryCode: "us",
      }),
    );
    expect(errors.billingPostalCode).toBe(
      "Enter a 5-digit billing ZIP code, like 12345.",
    );
  });

  it("does not apply the US ZIP pattern to a non-US billing address", () => {
    const errors = validateCheckoutDraft(
      makeDraft({
        billingSameAsDelivery: false,
        billingAddress1: "1 Elm St",
        billingCity: "Toronto",
        billingState: "ON",
        billingPostalCode: "M5V 2T6",
        billingCountryCode: "ca",
      }),
    );
    expect(errors.billingPostalCode).toBeUndefined();
  });

  it("reports no errors for a fully valid billing address", () => {
    const errors = validateCheckoutDraft(
      makeDraft({
        billingSameAsDelivery: false,
        billingAddress1: "1 Elm St",
        billingCity: "Portland",
        billingState: "OR",
        billingPostalCode: "97201",
        billingCountryCode: "us",
      }),
    );
    expect(errors).toEqual({});
  });
});

describe("isCheckoutDraftValid", () => {
  it("is true for a fully filled draft", () => {
    expect(isCheckoutDraftValid(makeDraft())).toBe(true);
  });

  it("is false when one required field is blank", () => {
    expect(isCheckoutDraftValid(makeDraft({ city: "" }))).toBe(false);
  });
});

describe("prefillCheckoutDraft", () => {
  const customer = {
    id: "cus_1",
    email: "customer@example.com",
    first_name: "Sarah",
    last_name: "Nguyen",
  };

  it("fills blank name and email fields from the customer", () => {
    const result = prefillCheckoutDraft(EMPTY_CHECKOUT_DRAFT, customer);

    expect(result.email).toBe("customer@example.com");
    expect(result.firstName).toBe("Sarah");
    expect(result.lastName).toBe("Nguyen");
  });

  it("keeps a non-blank draft value over the customer's", () => {
    const result = prefillCheckoutDraft(
      makeDraft({ email: "typed@example.com" }),
      customer,
    );

    expect(result.email).toBe("typed@example.com");
  });

  it("is a no-op for a null customer", () => {
    const draft = EMPTY_CHECKOUT_DRAFT;
    expect(prefillCheckoutDraft(draft, null)).toBe(draft);
  });

  it("does not mutate its input draft", () => {
    const draft = { ...EMPTY_CHECKOUT_DRAFT };
    prefillCheckoutDraft(draft, customer);
    expect(draft).toEqual(EMPTY_CHECKOUT_DRAFT);
  });
});

describe("countryOptions", () => {
  it("maps display_name, falling back to name, then the uppercased code", () => {
    const region: RegionSource = {
      id: "reg_1",
      countries: [
        { iso_2: "us", display_name: "United States" },
        { iso_2: "ca", name: "Canada" },
        { iso_2: "mx" },
      ],
    };

    expect(countryOptions(region)).toEqual([
      { id: "ca", label: "Canada" },
      { id: "mx", label: "MX" },
      { id: "us", label: "United States" },
    ]);
  });

  it("drops countries with no iso_2 code", () => {
    const region: RegionSource = {
      id: "reg_1",
      countries: [{ iso_2: null, display_name: "Nowhere" }],
    };

    expect(countryOptions(region)).toEqual([
      { id: "us", label: "United States" },
    ]);
  });

  it("lowercases the id even when the source code is uppercase", () => {
    const region: RegionSource = {
      id: "reg_1",
      countries: [{ iso_2: "US", display_name: "United States" }],
    };

    expect(countryOptions(region)?.[0]?.id).toBe("us");
  });

  it("falls back to a US-only list for a null region", () => {
    expect(countryOptions(null)).toEqual([
      { id: "us", label: "United States" },
    ]);
  });

  it("falls back to a US-only list for a region with no countries", () => {
    expect(countryOptions({ id: "reg_1", countries: [] })).toEqual([
      { id: "us", label: "United States" },
    ]);
  });
});

describe("checkoutTotals", () => {
  function makeCart(overrides: Partial<Cart> = {}): Cart {
    return { lines: [], ...overrides };
  }

  it("sets the total equal to the subtotal", () => {
    const cart = makeCart({
      lines: [
        {
          id: "sticker",
          href: "/products/sticker",
          title: "Sticker",
          unitPrice: 0.75,
          currencyCode: "usd",
          quantity: 2,
        },
      ],
    });

    expect(checkoutTotals(cart)).toEqual({
      subtotal: 1.5,
      total: 1.5,
      currencyCode: "usd",
    });
  });

  it("takes the currency code from the first line", () => {
    const cart = makeCart({
      lines: [
        {
          id: "a",
          href: "/a",
          title: "A",
          unitPrice: 10,
          currencyCode: "cad",
          quantity: 1,
        },
      ],
    });

    expect(checkoutTotals(cart).currencyCode).toBe("cad");
  });

  it("returns zero for an empty cart", () => {
    expect(checkoutTotals(makeCart())).toEqual({
      subtotal: 0,
      total: 0,
      currencyCode: "usd",
    });
  });
});
