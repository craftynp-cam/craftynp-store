import type { ReactNode } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import { CheckoutView } from "@/components";
import type { SavedAddress } from "@/lib/saved-address";
import type { AuthedCustomer } from "@/lib/auth";
import { CHECKOUT_STORAGE_KEY, clearCheckoutDraft } from "@/lib/checkout-draft";
import { addCartLine, clearCart, readCart } from "@/lib/cart";
import { setCartDrawerOpen } from "@/lib/cart-drawer";

const mockRouterPush = jest.fn();

jest.mock("next/navigation", () => ({
  usePathname: () => "/checkout",
  useRouter: () => ({ push: mockRouterPush }),
}));

const mockConfirmPayment = jest.fn();
let mockStripeInstance: { confirmPayment: typeof mockConfirmPayment } | null = {
  confirmPayment: mockConfirmPayment,
};
let mockElementsInstance: object | null = {};

// A thin stand-in for @stripe/react-stripe-js: no real Elements provider or
// iframe-backed PaymentElement, so nothing here makes a network call. Tests
// that need a specific outcome set mockStripeInstance/mockConfirmPayment.
jest.mock("@stripe/react-stripe-js", () => ({
  Elements: ({ children }: { children: ReactNode }) => children,
  PaymentElement: () => null,
  useStripe: () => mockStripeInstance,
  useElements: () => mockElementsInstance,
}));

jest.mock("@stripe/stripe-js", () => ({
  loadStripe: () => Promise.resolve(null),
}));

const countryOptions = [{ id: "us", label: "United States" }];

const customer: AuthedCustomer = {
  id: "cus_1",
  email: "sarah@example.com",
  first_name: "Sarah",
  last_name: "Nguyen",
};

const savedAddress: SavedAddress = {
  id: "caddr_1",
  label: "123 Maple Street, Springfield, IL 62704",
  firstName: "Jamie",
  lastName: "Rivera",
  address1: "123 Maple Street",
  address2: "",
  city: "Springfield",
  state: "IL",
  postalCode: "62704",
  countryCode: "us",
  phone: "5551234567",
  isDefaultShipping: true,
};

const otherAddress: SavedAddress = {
  id: "caddr_2",
  label: "456 Oak Avenue, Portland, OR 97201",
  firstName: "Jamie",
  lastName: "Rivera",
  address1: "456 Oak Avenue",
  address2: "",
  city: "Portland",
  state: "OR",
  postalCode: "97201",
  countryCode: "us",
  phone: "5559876543",
  isDefaultShipping: false,
};

const singleRateResponse = {
  rates: [
    {
      rateId: "se-1",
      carrierName: "USPS",
      serviceName: "USPS Ground Advantage",
      serviceCode: "usps_ground_advantage",
      amount: 7.42,
      currencyCode: "usd",
      deliveryDays: 4,
      estimatedDeliveryDate: null,
      quoteToken: "token.signature",
    },
  ],
};

const taxQuoteResponse = {
  taxAmount: 0.68,
  currencyCode: "usd",
  quoteToken: "tax-token.signature",
};

function mockFetchWithRatesAnd(addressResponse: {
  ok: boolean;
  status: number;
}) {
  return jest.fn().mockImplementation((url: string) => {
    if (url === "/checkout/shipping-rates") {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(singleRateResponse),
      });
    }
    if (url === "/checkout/tax") {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(taxQuoteResponse),
      });
    }
    return Promise.resolve(addressResponse);
  });
}

function fillValidForm() {
  fireEvent.change(screen.getByLabelText("First name"), {
    target: { value: "Jamie" },
  });
  fireEvent.change(screen.getByLabelText("Last name"), {
    target: { value: "Rivera" },
  });
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "jamie@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Phone"), {
    target: { value: "5551234567" },
  });
  fireEvent.change(screen.getByLabelText("Street address"), {
    target: { value: "123 Maple Street" },
  });
  fireEvent.change(screen.getByLabelText("City"), {
    target: { value: "Springfield" },
  });
  fireEvent.change(screen.getByLabelText("State"), {
    target: { value: "IL" },
  });
  fireEvent.change(screen.getByLabelText("ZIP code"), {
    target: { value: "62704" },
  });
}

describe("CheckoutView", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    clearCart();
    clearCheckoutDraft();
    setCartDrawerOpen(false);
    jest.restoreAllMocks();
    mockRouterPush.mockClear();
    mockConfirmPayment.mockReset();
    mockStripeInstance = { confirmPayment: mockConfirmPayment };
    mockElementsInstance = {};
  });

  it("renders the page heading and all four sections", () => {
    render(
      <CheckoutView
        customer={null}
        savedAddresses={[]}
        countryOptions={countryOptions}
      />,
    );

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Checkout",
    );
    expect(screen.getByRole("region", { name: /Contact/ })).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: /Delivery address/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: /Shipping method/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /Payment/ })).toBeInTheDocument();
    // No card fields render until a Stripe payment session is ready.
    expect(document.querySelector('input[name="cardNumber"]')).toBeNull();
  });

  it("renders the breadcrumb trail", () => {
    render(
      <CheckoutView
        customer={null}
        savedAddresses={[]}
        countryOptions={countryOptions}
      />,
    );

    expect(
      screen.getByRole("navigation", { name: "Breadcrumb" }),
    ).toBeInTheDocument();
  });

  it("lets a guest complete the form with no account controls", async () => {
    const fetchMock = mockFetchWithRatesAnd({ ok: true, status: 201 });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <CheckoutView
        customer={null}
        savedAddresses={[]}
        countryOptions={countryOptions}
      />,
    );

    expect(document.querySelector('input[type="password"]')).toBeNull();
    expect(screen.queryByText("Create an account")).not.toBeInTheDocument();

    fillValidForm();
    await waitFor(() =>
      expect(screen.getByText("USPS Ground Advantage")).toBeInTheDocument(),
    );
    await waitFor(
      () =>
        expect(fetchMock).toHaveBeenCalledWith(
          "/checkout/tax",
          expect.anything(),
        ),
      { timeout: 2000 },
    );
    fireEvent.click(screen.getByRole("button", { name: /^Pay/ }));

    // The guest's fields all validate, but payment never becomes ready in
    // this test (no /checkout/prepare mock), so nothing navigates away.
    expect(mockRouterPush).not.toHaveBeenCalled();
  }, 15000);

  it("shows a specific message for every required field left blank", () => {
    render(
      <CheckoutView
        customer={null}
        savedAddresses={[]}
        countryOptions={countryOptions}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^Pay/ }));

    expect(screen.getByText("Enter your first name.")).toBeInTheDocument();
    expect(screen.getByText("Enter your last name.")).toBeInTheDocument();
    expect(screen.getByText("Enter your email address.")).toBeInTheDocument();
    expect(
      screen.getByText("Enter a phone number for delivery updates."),
    ).toBeInTheDocument();
    expect(screen.getByText("Enter your street address.")).toBeInTheDocument();
    expect(screen.getByText("Enter your city.")).toBeInTheDocument();
    expect(screen.getByText("Enter your state.")).toBeInTheDocument();
    expect(screen.getByText("Enter your ZIP code.")).toBeInTheDocument();

    expect(screen.getByLabelText("First name")).toHaveFocus();
    expect(screen.getByText("Check 9 fields below.")).toBeInTheDocument();
  });

  it("clears a field's message once it is filled and resubmitted", () => {
    render(
      <CheckoutView
        customer={null}
        savedAddresses={[]}
        countryOptions={countryOptions}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^Pay/ }));
    expect(screen.getByText("Enter your first name.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("First name"), {
      target: { value: "Jamie" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Pay/ }));

    expect(
      screen.queryByText("Enter your first name."),
    ).not.toBeInTheDocument();
  });

  it("gives a different message for a malformed email than a blank one", () => {
    render(
      <CheckoutView
        customer={null}
        savedAddresses={[]}
        countryOptions={countryOptions}
      />,
    );

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "not-an-email" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Pay/ }));

    expect(
      screen.getByText("Enter an email address like name@example.com."),
    ).toBeInTheDocument();
  });

  it("unfurls a billing address block when the checkbox is unchecked, and validates it on submit", () => {
    render(
      <CheckoutView
        customer={null}
        savedAddresses={[]}
        countryOptions={countryOptions}
      />,
    );

    expect(screen.queryByLabelText("Billing Street address")).toBeNull();

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Billing address is the same as delivery",
      }),
    );

    expect(screen.getByLabelText("Billing Street address")).toBeInTheDocument();

    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: /^Pay/ }));

    expect(
      screen.getByText("Enter the billing street address."),
    ).toBeInTheDocument();
    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it("drops stale billing error messages once billing is marked same as delivery again", () => {
    render(
      <CheckoutView
        customer={null}
        savedAddresses={[]}
        countryOptions={countryOptions}
      />,
    );

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Billing address is the same as delivery",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /^Pay/ }));
    expect(
      screen.getByText("Enter the billing street address."),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Billing address is the same as delivery",
      }),
    );

    expect(screen.queryByLabelText("Billing Street address")).toBeNull();
    expect(
      screen.queryByText("Enter the billing street address."),
    ).not.toBeInTheDocument();
    // Only the 8 still-blank delivery/contact fields should count — the 4
    // billing errors must not survive the re-check as a phantom tally.
    expect(screen.getByText("Check 9 fields below.")).toBeInTheDocument();
  });

  it("preselects the customer's default saved address on load, with no click required", () => {
    render(
      <CheckoutView
        customer={customer}
        savedAddresses={[savedAddress, otherAddress]}
        countryOptions={countryOptions}
      />,
    );

    expect(
      screen.getByRole("radio", {
        name: "123 Maple Street, Springfield, IL 62704",
      }),
    ).toBeChecked();
    expect(screen.getByLabelText("Street address")).toHaveValue(
      "123 Maple Street",
    );
    expect(screen.getByLabelText("City")).toHaveValue("Springfield");
    expect(screen.getByLabelText("State")).toHaveValue("IL");
    expect(screen.getByLabelText("ZIP code")).toHaveValue("62704");
  });

  it("fills the fields for the address the shopper manually selects", () => {
    render(
      <CheckoutView
        customer={customer}
        savedAddresses={[savedAddress, otherAddress]}
        countryOptions={countryOptions}
      />,
    );

    fireEvent.click(
      screen.getByRole("radio", {
        name: "456 Oak Avenue, Portland, OR 97201",
      }),
    );

    expect(screen.getByLabelText("Street address")).toHaveValue(
      "456 Oak Avenue",
    );
    expect(screen.getByLabelText("City")).toHaveValue("Portland");
    expect(screen.getByLabelText("State")).toHaveValue("OR");
    expect(screen.getByLabelText("ZIP code")).toHaveValue("97201");
  });

  it("clears the address fields when 'Enter a new address' is selected, and does not revert to the default", () => {
    render(
      <CheckoutView
        customer={customer}
        savedAddresses={[savedAddress]}
        countryOptions={countryOptions}
      />,
    );

    expect(screen.getByLabelText("Street address")).toHaveValue(
      "123 Maple Street",
    );

    fireEvent.click(screen.getByRole("radio", { name: "Enter a new address" }));

    expect(screen.getByLabelText("Street address")).toHaveValue("");
    expect(screen.getByLabelText("City")).toHaveValue("");
    expect(screen.getByLabelText("State")).toHaveValue("");
    expect(screen.getByLabelText("ZIP code")).toHaveValue("");

    fireEvent.change(screen.getByLabelText("First name"), {
      target: { value: "Someone" },
    });

    expect(screen.getByLabelText("Street address")).toHaveValue("");
  });

  it("hides the saved-address picker and save checkbox for a guest even when addresses are passed", () => {
    render(
      <CheckoutView
        customer={null}
        savedAddresses={[savedAddress]}
        countryOptions={countryOptions}
      />,
    );

    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Save this address to my account"),
    ).not.toBeInTheDocument();
  });

  it("persists field values across an unmount and remount", () => {
    const { unmount } = render(
      <CheckoutView
        customer={null}
        savedAddresses={[]}
        countryOptions={countryOptions}
      />,
    );

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "jamie@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Street address"), {
      target: { value: "123 Maple Street" },
    });
    unmount();

    render(
      <CheckoutView
        customer={null}
        savedAddresses={[]}
        countryOptions={countryOptions}
      />,
    );

    expect(screen.getByLabelText("Email")).toHaveValue("jamie@example.com");
    expect(screen.getByLabelText("Street address")).toHaveValue(
      "123 Maple Street",
    );

    const stored = JSON.parse(
      window.localStorage.getItem(CHECKOUT_STORAGE_KEY) ?? "{}",
    );
    expect(stored.email).toBe("jamie@example.com");
    expect(stored.address1).toBe("123 Maple Street");
  });

  it("prefills name and email from a signed-in customer", () => {
    render(
      <CheckoutView
        customer={customer}
        savedAddresses={[]}
        countryOptions={countryOptions}
      />,
    );

    expect(screen.getByLabelText("First name")).toHaveValue("Sarah");
    expect(screen.getByLabelText("Email")).toHaveValue("sarah@example.com");
  });

  it("keeps a typed value over the customer's prefilled one", () => {
    render(
      <CheckoutView
        customer={customer}
        savedAddresses={[]}
        countryOptions={countryOptions}
      />,
    );

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "typed@example.com" },
    });

    expect(screen.getByLabelText("Email")).toHaveValue("typed@example.com");
  });

  it("submits as a real button, with no navigation until payment succeeds", async () => {
    const fetchMock = mockFetchWithRatesAnd({ ok: true, status: 201 });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <CheckoutView
        customer={null}
        savedAddresses={[]}
        countryOptions={countryOptions}
      />,
    );

    const button = screen.getByRole("button", { name: /^Pay/ });
    expect(button).toHaveAttribute("type", "submit");
    expect(button.tagName).toBe("BUTTON");

    fillValidForm();
    await waitFor(() =>
      expect(screen.getByText("USPS Ground Advantage")).toBeInTheDocument(),
    );
    await waitFor(
      () =>
        expect(fetchMock).toHaveBeenCalledWith(
          "/checkout/tax",
          expect.anything(),
        ),
      { timeout: 2000 },
    );
    fireEvent.click(button);

    // No /checkout/prepare mock in this test, so payment never becomes
    // ready — clicking Pay validates the fields but does not navigate.
    expect(mockRouterPush).not.toHaveBeenCalled();
  }, 15000);

  it("posts the mapped address once when the save checkbox is checked", async () => {
    const fetchMock = mockFetchWithRatesAnd({ ok: true, status: 201 });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <CheckoutView
        customer={customer}
        savedAddresses={[]}
        countryOptions={countryOptions}
      />,
    );

    fillValidForm();
    await waitFor(() =>
      expect(screen.getByText("USPS Ground Advantage")).toBeInTheDocument(),
    );
    await waitFor(
      () =>
        expect(fetchMock).toHaveBeenCalledWith(
          "/checkout/tax",
          expect.anything(),
        ),
      { timeout: 2000 },
    );
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Save this address to my account" }),
    );
    fireEvent.click(screen.getByRole("button", { name: /^Pay/ }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/checkout/addresses",
        expect.anything(),
      ),
    );
    const addressCall = fetchMock.mock.calls.find(
      ([url]) => url === "/checkout/addresses",
    )!;
    expect(JSON.parse(addressCall[1]!.body as string)).toMatchObject({
      firstName: "Jamie",
      lastName: "Rivera",
      address1: "123 Maple Street",
      city: "Springfield",
      state: "IL",
      postalCode: "62704",
    });
  }, 15000);

  it("shows a non-blocking notice and still completes when the save request fails", async () => {
    const fetchMock = mockFetchWithRatesAnd({ ok: false, status: 502 });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <CheckoutView
        customer={customer}
        savedAddresses={[]}
        countryOptions={countryOptions}
      />,
    );

    fillValidForm();
    await waitFor(() =>
      expect(screen.getByText("USPS Ground Advantage")).toBeInTheDocument(),
    );
    await waitFor(
      () =>
        expect(fetchMock).toHaveBeenCalledWith(
          "/checkout/tax",
          expect.anything(),
        ),
      { timeout: 2000 },
    );
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Save this address to my account" }),
    );
    fireEvent.click(screen.getByRole("button", { name: /^Pay/ }));

    await waitFor(() =>
      expect(
        screen.getByText(/We couldn't save this address/),
      ).toBeInTheDocument(),
    );
    // The failed address save is non-blocking — validation still passed and
    // nothing crashed, it just never reached a completed payment.
    expect(mockRouterPush).not.toHaveBeenCalled();
  }, 15000);

  it("fires no fetch when the save checkbox is left unchecked", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;

    render(
      <CheckoutView
        customer={customer}
        savedAddresses={[]}
        countryOptions={countryOptions}
      />,
    );

    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: /^Pay/ }));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  describe("shipping rates", () => {
    const rateResponse = {
      rates: [
        {
          rateId: "se-1",
          carrierName: "USPS",
          serviceName: "USPS Ground Advantage",
          serviceCode: "usps_ground_advantage",
          amount: 7.42,
          currencyCode: "usd",
          deliveryDays: 4,
          estimatedDeliveryDate: null,
          quoteToken: "token.signature",
        },
      ],
    };

    function mockRatesFetch() {
      return jest.fn().mockImplementation((url: string) => {
        if (url === "/checkout/shipping-rates") {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(rateResponse),
          });
        }
        if (url === "/checkout/tax") {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(taxQuoteResponse),
          });
        }
        return Promise.resolve({ ok: true, status: 201 });
      });
    }

    beforeEach(() => {
      jest.useFakeTimers({ legacyFakeTimers: false });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("fires no request while the address is incomplete", async () => {
      const fetchMock = mockRatesFetch();
      global.fetch = fetchMock as unknown as typeof fetch;

      render(
        <CheckoutView
          customer={null}
          savedAddresses={[]}
          countryOptions={countryOptions}
        />,
      );

      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      expect(fetchMock).not.toHaveBeenCalledWith(
        "/checkout/shipping-rates",
        expect.anything(),
      );
    });

    it("makes one request after the debounce once the address is complete", async () => {
      const fetchMock = mockRatesFetch();
      global.fetch = fetchMock as unknown as typeof fetch;

      render(
        <CheckoutView
          customer={null}
          savedAddresses={[]}
          countryOptions={countryOptions}
        />,
      );

      fillValidForm();

      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      const ratesCalls = fetchMock.mock.calls.filter(
        ([url]) => url === "/checkout/shipping-rates",
      );
      expect(ratesCalls).toHaveLength(1);
    });

    it("does not re-fetch for an unchanged destination and cart", async () => {
      const fetchMock = mockRatesFetch();
      global.fetch = fetchMock as unknown as typeof fetch;

      render(
        <CheckoutView
          customer={null}
          savedAddresses={[]}
          countryOptions={countryOptions}
        />,
      );

      fillValidForm();
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      fireEvent.change(screen.getByLabelText("Last name"), {
        target: { value: "Rivera-Smith" },
      });
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      const ratesCalls = fetchMock.mock.calls.filter(
        ([url]) => url === "/checkout/shipping-rates",
      );
      expect(ratesCalls).toHaveLength(1);
    });

    it("blocks submission while shipping rates are still loading, with no rate chosen", async () => {
      const fetchMock = mockRatesFetch();
      global.fetch = fetchMock as unknown as typeof fetch;

      render(
        <CheckoutView
          customer={null}
          savedAddresses={[]}
          countryOptions={countryOptions}
        />,
      );

      fillValidForm();
      fireEvent.click(screen.getByRole("button", { name: /^Pay/ }));

      expect(screen.getByText("Check 1 field below.")).toBeInTheDocument();
      expect(mockRouterPush).not.toHaveBeenCalled();
    });

    it("auto-selects the returned rate and lets tax and payment proceed", async () => {
      const fetchMock = mockRatesFetch();
      global.fetch = fetchMock as unknown as typeof fetch;

      render(
        <CheckoutView
          customer={null}
          savedAddresses={[]}
          countryOptions={countryOptions}
        />,
      );

      fillValidForm();
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
      await waitFor(() =>
        expect(screen.getByText("USPS Ground Advantage")).toBeInTheDocument(),
      );

      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
      await waitFor(() =>
        expect(fetchMock).toHaveBeenCalledWith(
          "/checkout/tax",
          expect.anything(),
        ),
      );

      // No rate/tax error remains once the auto-selected rate resolves and
      // the tax quote follows it — the shopper reaches the payment step.
      expect(
        screen.queryByText(
          "We couldn't get a shipping rate for your address right now.",
        ),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText("We couldn't calculate tax for your address."),
      ).not.toBeInTheDocument();
    });

    it("shows an error and blocks submission when ShipStation is unavailable — no flat-rate fallback", async () => {
      const fetchMock = jest.fn().mockImplementation((url: string) => {
        if (url === "/checkout/shipping-rates") {
          return Promise.resolve({ ok: false, status: 502 });
        }
        return Promise.resolve({ ok: true, status: 201 });
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      render(
        <CheckoutView
          customer={null}
          savedAddresses={[]}
          countryOptions={countryOptions}
        />,
      );

      fillValidForm();
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
      await waitFor(() =>
        expect(
          screen.getByText(
            "We couldn't get a shipping rate for your address right now.",
          ),
        ).toBeInTheDocument(),
      );

      expect(screen.queryByRole("radio")).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /^Pay/ }));

      expect(mockRouterPush).not.toHaveBeenCalled();
      expect(screen.getByText("Check 1 field below.")).toBeInTheDocument();
    });

    it("retries the rate call when Try again is clicked", async () => {
      let shouldFail = true;
      const fetchMock = jest.fn().mockImplementation((url: string) => {
        if (url === "/checkout/shipping-rates") {
          if (shouldFail) return Promise.resolve({ ok: false, status: 502 });
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(rateResponse),
          });
        }
        return Promise.resolve({ ok: true, status: 201 });
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      render(
        <CheckoutView
          customer={null}
          savedAddresses={[]}
          countryOptions={countryOptions}
        />,
      );

      fillValidForm();
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Try again" }),
        ).toBeInTheDocument(),
      );

      shouldFail = false;
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));

      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
      await waitFor(() =>
        expect(screen.getByText("USPS Ground Advantage")).toBeInTheDocument(),
      );
    });
  });

  describe("tax", () => {
    function mockRatesAndTaxFetch(
      taxResponse: { ok: boolean; status: number } = { ok: true, status: 200 },
    ) {
      return jest.fn().mockImplementation((url: string) => {
        if (url === "/checkout/shipping-rates") {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(singleRateResponse),
          });
        }
        if (url === "/checkout/tax") {
          if (!taxResponse.ok) return Promise.resolve(taxResponse);
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(taxQuoteResponse),
          });
        }
        return Promise.resolve({ ok: true, status: 201 });
      });
    }

    beforeEach(() => {
      jest.useFakeTimers({ legacyFakeTimers: false });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("fires no tax request until a shipping rate is chosen", async () => {
      const fetchMock = jest.fn().mockImplementation((url: string) => {
        if (url === "/checkout/shipping-rates") {
          // Never resolves, so a shipping rate is never chosen.
          return new Promise(() => {});
        }
        return Promise.resolve({ ok: true, status: 201 });
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      render(
        <CheckoutView
          customer={null}
          savedAddresses={[]}
          countryOptions={countryOptions}
        />,
      );

      fillValidForm();
      await act(async () => {
        jest.advanceTimersByTime(2000);
      });

      expect(fetchMock).not.toHaveBeenCalledWith(
        "/checkout/tax",
        expect.anything(),
      );
    });

    it("makes one tax request after the shipping rate resolves", async () => {
      const fetchMock = mockRatesAndTaxFetch();
      global.fetch = fetchMock as unknown as typeof fetch;

      render(
        <CheckoutView
          customer={null}
          savedAddresses={[]}
          countryOptions={countryOptions}
        />,
      );

      fillValidForm();
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
      await waitFor(() =>
        expect(screen.getByText("USPS Ground Advantage")).toBeInTheDocument(),
      );
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      const taxCalls = fetchMock.mock.calls.filter(
        ([url]) => url === "/checkout/tax",
      );
      expect(taxCalls).toHaveLength(1);
    });

    it("shows the calculated tax in the order summary once resolved", async () => {
      const fetchMock = mockRatesAndTaxFetch();
      global.fetch = fetchMock as unknown as typeof fetch;

      render(
        <CheckoutView
          customer={null}
          savedAddresses={[]}
          countryOptions={countryOptions}
        />,
      );

      fillValidForm();
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
      await waitFor(() =>
        expect(screen.getByText("USPS Ground Advantage")).toBeInTheDocument(),
      );
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() =>
        expect(screen.getByText("$0.68")).toBeInTheDocument(),
      );
    });

    it("shows an error and blocks submission when Stripe Tax is unavailable", async () => {
      const fetchMock = mockRatesAndTaxFetch({ ok: false, status: 502 });
      global.fetch = fetchMock as unknown as typeof fetch;

      render(
        <CheckoutView
          customer={null}
          savedAddresses={[]}
          countryOptions={countryOptions}
        />,
      );

      fillValidForm();
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
      await waitFor(() =>
        expect(screen.getByText("USPS Ground Advantage")).toBeInTheDocument(),
      );
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
      await waitFor(() =>
        expect(
          screen.getByText(
            "We couldn't calculate tax for your address right now.",
          ),
        ).toBeInTheDocument(),
      );

      fireEvent.click(screen.getByRole("button", { name: /^Pay/ }));

      expect(mockRouterPush).not.toHaveBeenCalled();
      expect(screen.getByText("Check 1 field below.")).toBeInTheDocument();
    });

    it("retries the tax call when Try again is clicked", async () => {
      let shouldFail = true;
      const fetchMock = jest.fn().mockImplementation((url: string) => {
        if (url === "/checkout/shipping-rates") {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(singleRateResponse),
          });
        }
        if (url === "/checkout/tax") {
          if (shouldFail) return Promise.resolve({ ok: false, status: 502 });
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(taxQuoteResponse),
          });
        }
        return Promise.resolve({ ok: true, status: 201 });
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      render(
        <CheckoutView
          customer={null}
          savedAddresses={[]}
          countryOptions={countryOptions}
        />,
      );

      fillValidForm();
      await act(async () => {
        jest.advanceTimersByTime(2000);
      });
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Try again" }),
        ).toBeInTheDocument(),
      );

      shouldFail = false;
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));

      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
      await waitFor(() =>
        expect(screen.getByText("$0.68")).toBeInTheDocument(),
      );
    });

    it("does not fire a tax request against a stale quote token while the shipping rate is re-resolving for a changed address", async () => {
      const secondRateResponse = {
        rates: [
          {
            rateId: "se-2",
            carrierName: "USPS",
            serviceName: "USPS Ground Advantage",
            serviceCode: "usps_ground_advantage",
            amount: 5.16,
            currencyCode: "usd",
            deliveryDays: 2,
            estimatedDeliveryDate: null,
            quoteToken: "second-token.signature",
          },
        ],
      };

      let shippingCallCount = 0;
      const pendingSecondCall: { resolve: (() => void) | null } = {
        resolve: null,
      };

      const fetchMock = jest.fn().mockImplementation((url: string) => {
        if (url === "/checkout/shipping-rates") {
          shippingCallCount += 1;
          if (shippingCallCount === 1) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve(singleRateResponse),
            });
          }
          // The second call (for the changed address) hangs until released
          // below, simulating a still-resolving shipping rate.
          return new Promise((resolve) => {
            pendingSecondCall.resolve = () =>
              resolve({
                ok: true,
                json: () => Promise.resolve(secondRateResponse),
              });
          });
        }
        if (url === "/checkout/tax") {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(taxQuoteResponse),
          });
        }
        return Promise.resolve({ ok: true, status: 201 });
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      render(
        <CheckoutView
          customer={null}
          savedAddresses={[]}
          countryOptions={countryOptions}
        />,
      );

      fillValidForm();
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
      await waitFor(() =>
        expect(screen.getByText("USPS Ground Advantage")).toBeInTheDocument(),
      );
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
      await waitFor(() =>
        expect(screen.getByText("$0.68")).toBeInTheDocument(),
      );

      const taxCallsBeforeEdit = fetchMock.mock.calls.filter(
        ([url]) => url === "/checkout/tax",
      ).length;

      fireEvent.change(screen.getByLabelText("ZIP code"), {
        target: { value: "60605" },
      });

      await act(async () => {
        jest.advanceTimersByTime(2000);
      });

      const taxCallsWhileShippingLoading = fetchMock.mock.calls.filter(
        ([url]) => url === "/checkout/tax",
      ).length;
      expect(taxCallsWhileShippingLoading).toBe(taxCallsBeforeEdit);

      pendingSecondCall.resolve?.();
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() =>
        expect(
          fetchMock.mock.calls.filter(([url]) => url === "/checkout/tax")
            .length,
        ).toBeGreaterThan(taxCallsBeforeEdit),
      );
    });
  });

  describe("payment", () => {
    const prepareResponse = {
      cartId: "cart_1",
      clientSecret: "pi_1_secret_abc",
      totals: {
        subtotal: 20,
        shipping: 7.42,
        tax: 0.68,
        total: 28.1,
        currencyCode: "usd",
      },
    };

    function mockFullCheckoutFetch(
      overrides: {
        prepare?: { ok: boolean; status?: number; body?: unknown };
        complete?: { ok: boolean; status?: number; body?: unknown };
      } = {},
    ) {
      const prepare = overrides.prepare ?? { ok: true, body: prepareResponse };
      const complete = overrides.complete ?? {
        ok: true,
        body: { orderId: "order_1", displayId: 42 },
      };

      return jest.fn().mockImplementation((url: string) => {
        if (url === "/checkout/shipping-rates") {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(singleRateResponse),
          });
        }
        if (url === "/checkout/tax") {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(taxQuoteResponse),
          });
        }
        if (url === "/checkout/prepare") {
          return Promise.resolve({
            ok: prepare.ok,
            status: prepare.status ?? (prepare.ok ? 200 : 502),
            json: () => Promise.resolve(prepare.body),
          });
        }
        if (url === "/checkout/complete") {
          return Promise.resolve({
            ok: complete.ok,
            status: complete.status ?? (complete.ok ? 200 : 502),
            json: () => Promise.resolve(complete.body),
          });
        }
        return Promise.resolve({ ok: true, status: 201 });
      });
    }

    async function reachReadyPayment(fetchMock: jest.Mock) {
      render(
        <CheckoutView
          customer={null}
          savedAddresses={[]}
          countryOptions={countryOptions}
        />,
      );

      fillValidForm();
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
      await waitFor(() =>
        expect(screen.getByText("USPS Ground Advantage")).toBeInTheDocument(),
      );
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
      await waitFor(() =>
        expect(fetchMock).toHaveBeenCalledWith(
          "/checkout/tax",
          expect.anything(),
        ),
      );
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
      await waitFor(() =>
        expect(fetchMock).toHaveBeenCalledWith(
          "/checkout/prepare",
          expect.anything(),
        ),
      );
    }

    beforeEach(() => {
      jest.useFakeTimers({ legacyFakeTimers: false });
      addCartLine({
        id: "variant_1",
        href: "/craft/mug",
        title: "Custom Mug",
        unitPrice: 20,
        currencyCode: "usd",
        quantity: 1,
      });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("confirms payment, clears the cart, and redirects to the confirmation page", async () => {
      const fetchMock = mockFullCheckoutFetch();
      global.fetch = fetchMock as unknown as typeof fetch;
      mockConfirmPayment.mockResolvedValue({});

      await reachReadyPayment(fetchMock);

      fireEvent.click(screen.getByRole("button", { name: /^Pay/ }));

      await waitFor(() =>
        expect(fetchMock).toHaveBeenCalledWith(
          "/checkout/complete",
          expect.anything(),
        ),
      );
      await waitFor(() =>
        expect(mockRouterPush).toHaveBeenCalledWith(
          "/checkout/confirmation?order=order_1&number=42",
        ),
      );

      expect(readCart().lines).toHaveLength(0);
      expect(window.localStorage.getItem(CHECKOUT_STORAGE_KEY)).not.toContain(
        "cart_1",
      );
    });

    it("shows Stripe's decline reason, keeps the cart intact, and allows retry", async () => {
      const fetchMock = mockFullCheckoutFetch();
      global.fetch = fetchMock as unknown as typeof fetch;
      mockConfirmPayment.mockResolvedValue({
        error: { message: "Your card was declined." },
      });

      await reachReadyPayment(fetchMock);

      fireEvent.click(screen.getByRole("button", { name: /^Pay/ }));

      await waitFor(() =>
        expect(screen.getByText("Your card was declined.")).toBeInTheDocument(),
      );

      expect(mockRouterPush).not.toHaveBeenCalled();
      expect(readCart().lines).toHaveLength(1);

      const completeCalls = fetchMock.mock.calls.filter(
        ([url]) => url === "/checkout/complete",
      );
      expect(completeCalls).toHaveLength(0);

      // Retry: the button is usable again, not stuck in a loading state.
      mockConfirmPayment.mockResolvedValue({});
      fireEvent.click(screen.getByRole("button", { name: /^Pay/ }));

      await waitFor(() =>
        expect(mockRouterPush).toHaveBeenCalledWith(
          "/checkout/confirmation?order=order_1&number=42",
        ),
      );
    });

    it("does not call /checkout/complete twice for a double click (AC10)", async () => {
      const fetchMock = mockFullCheckoutFetch();
      global.fetch = fetchMock as unknown as typeof fetch;
      const deferred: {
        resolve: (value: { error?: { message: string } }) => void;
      } = {} as never;
      mockConfirmPayment.mockReturnValue(
        new Promise((resolve) => {
          deferred.resolve = resolve;
        }),
      );

      await reachReadyPayment(fetchMock);

      const button = screen.getByRole("button", { name: /^Pay/ });
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);

      deferred.resolve({});

      await waitFor(() =>
        expect(mockRouterPush).toHaveBeenCalledWith(
          "/checkout/confirmation?order=order_1&number=42",
        ),
      );

      expect(mockConfirmPayment).toHaveBeenCalledTimes(1);
      const completeCalls = fetchMock.mock.calls.filter(
        ([url]) => url === "/checkout/complete",
      );
      expect(completeCalls).toHaveLength(1);
    });
  });
});
