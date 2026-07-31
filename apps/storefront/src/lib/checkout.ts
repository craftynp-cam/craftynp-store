import type { AuthedCustomer } from "./auth";
import type { Cart } from "./cart";
import { cartSubtotal } from "./cart";
import type { RegionSource } from "./region";

export type CheckoutDraft = {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  postalCode: string;
  countryCode: string;
  billingSameAsDelivery: boolean;
  billingAddress1: string;
  billingAddress2: string;
  billingCity: string;
  billingState: string;
  billingPostalCode: string;
  billingCountryCode: string;
  savedAddressId: string;
  shippingRateId: string;
  shippingRateLabel: string;
  shippingRateAmount: number;
  shippingRateCurrency: string;
  shippingServiceCode: string;
  shippingQuoteToken: string;
  taxAmount: number;
  taxCurrency: string;
  taxQuoteToken: string;
  cartId: string;
  paymentClientSecret: string;
};

export type CheckoutTextField =
  | "firstName"
  | "lastName"
  | "email"
  | "phone"
  | "address1"
  | "city"
  | "state"
  | "postalCode"
  | "countryCode"
  | "billingAddress1"
  | "billingCity"
  | "billingState"
  | "billingPostalCode"
  | "billingCountryCode"
  | "shippingRateId"
  | "taxQuoteToken";

export type CheckoutErrors = Partial<Record<CheckoutTextField, string>>;

export const EMPTY_CHECKOUT_DRAFT: CheckoutDraft = {
  email: "",
  firstName: "",
  lastName: "",
  phone: "",
  address1: "",
  address2: "",
  city: "",
  state: "",
  postalCode: "",
  countryCode: "us",
  billingSameAsDelivery: true,
  billingAddress1: "",
  billingAddress2: "",
  billingCity: "",
  billingState: "",
  billingPostalCode: "",
  billingCountryCode: "us",
  savedAddressId: "",
  shippingRateId: "",
  shippingRateLabel: "",
  shippingRateAmount: 0,
  shippingRateCurrency: "",
  shippingServiceCode: "",
  shippingQuoteToken: "",
  taxAmount: 0,
  taxCurrency: "",
  taxQuoteToken: "",
  cartId: "",
  paymentClientSecret: "",
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const US_ZIP_PATTERN = /^\d{5}(-\d{4})?$/;

function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

export type AddressFields = Pick<
  CheckoutDraft,
  | "firstName"
  | "lastName"
  | "address1"
  | "city"
  | "state"
  | "postalCode"
  | "countryCode"
>;

export function validateAddressFields(fields: AddressFields): CheckoutErrors {
  const errors: CheckoutErrors = {};

  if (isBlank(fields.firstName)) errors.firstName = "Enter your first name.";
  if (isBlank(fields.lastName)) errors.lastName = "Enter your last name.";

  if (isBlank(fields.address1)) errors.address1 = "Enter your street address.";
  if (isBlank(fields.city)) errors.city = "Enter your city.";
  if (isBlank(fields.state)) errors.state = "Enter your state.";

  const isUs = fields.countryCode === "us";
  if (isBlank(fields.postalCode)) {
    errors.postalCode = isUs
      ? "Enter your ZIP code."
      : "Enter your postal code.";
  } else if (isUs && !US_ZIP_PATTERN.test(fields.postalCode.trim())) {
    errors.postalCode = "Enter a 5-digit ZIP code, like 12345.";
  }

  if (isBlank(fields.countryCode)) errors.countryCode = "Choose a country.";

  return errors;
}

export function validateCheckoutDraft(draft: CheckoutDraft): CheckoutErrors {
  const errors: CheckoutErrors = validateAddressFields(draft);

  if (isBlank(draft.email)) {
    errors.email = "Enter your email address.";
  } else if (!EMAIL_PATTERN.test(draft.email.trim())) {
    errors.email = "Enter an email address like name@example.com.";
  }

  if (isBlank(draft.phone)) {
    errors.phone = "Enter a phone number for delivery updates.";
  } else if (draft.phone.replace(/\D/g, "").length < 10) {
    errors.phone = "Enter a phone number with at least 10 digits.";
  }

  if (!draft.billingSameAsDelivery) {
    if (isBlank(draft.billingAddress1)) {
      errors.billingAddress1 = "Enter the billing street address.";
    }
    if (isBlank(draft.billingCity))
      errors.billingCity = "Enter the billing city.";
    if (isBlank(draft.billingState)) {
      errors.billingState = "Enter the billing state.";
    }

    const isBillingUs = draft.billingCountryCode === "us";
    if (isBlank(draft.billingPostalCode)) {
      errors.billingPostalCode = isBillingUs
        ? "Enter the billing ZIP code."
        : "Enter the billing postal code.";
    } else if (
      isBillingUs &&
      !US_ZIP_PATTERN.test(draft.billingPostalCode.trim())
    ) {
      errors.billingPostalCode =
        "Enter a 5-digit billing ZIP code, like 12345.";
    }

    if (isBlank(draft.billingCountryCode)) {
      errors.billingCountryCode = "Choose a billing country.";
    }
  }

  if (isBlank(draft.shippingRateId)) {
    errors.shippingRateId = "Choose a delivery option.";
  } else if (isBlank(draft.taxQuoteToken)) {
    errors.taxQuoteToken = "We couldn't calculate tax for your address.";
  }

  return errors;
}

export function isCheckoutDraftValid(draft: CheckoutDraft): boolean {
  return Object.keys(validateCheckoutDraft(draft)).length === 0;
}

export function prefillCheckoutDraft(
  draft: CheckoutDraft,
  customer: AuthedCustomer | null,
): CheckoutDraft {
  if (!customer) return draft;

  return {
    ...draft,
    email: draft.email || customer.email || "",
    firstName: draft.firstName || customer.first_name || "",
    lastName: draft.lastName || customer.last_name || "",
  };
}

export type CountryOption = { id: string; label: string };

const FALLBACK_COUNTRY_OPTIONS: readonly CountryOption[] = [
  { id: "us", label: "United States" },
];

export function countryOptions(
  region: RegionSource | null,
): readonly CountryOption[] {
  const countries = region?.countries ?? [];
  const options = countries
    .filter(
      (
        country,
      ): country is {
        iso_2: string;
        display_name?: string | null;
        name?: string | null;
      } => typeof country.iso_2 === "string" && country.iso_2.length > 0,
    )
    .map((country) => ({
      id: country.iso_2.toLowerCase(),
      label:
        country.display_name ?? country.name ?? country.iso_2.toUpperCase(),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return options.length > 0 ? options : FALLBACK_COUNTRY_OPTIONS;
}

export type CheckoutTotals = {
  subtotal: number;
  shipping: number | null;
  tax: number | null;
  total: number;
  currencyCode: string;
};

export function checkoutTotals(
  cart: Cart,
  draft?: CheckoutDraft,
): CheckoutTotals {
  const { amount, currencyCode } = cartSubtotal(cart);
  const shipping =
    draft && draft.shippingRateId !== "" ? draft.shippingRateAmount : null;
  const tax = draft && draft.taxQuoteToken !== "" ? draft.taxAmount : null;

  return {
    subtotal: amount,
    shipping,
    tax,
    total: amount + (shipping ?? 0) + (tax ?? 0),
    currencyCode,
  };
}
