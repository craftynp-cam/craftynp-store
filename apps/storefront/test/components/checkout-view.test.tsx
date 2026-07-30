import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { CheckoutView } from "@/components";
import type { SavedAddress } from "@/lib/addresses";
import type { AuthedCustomer } from "@/lib/auth";
import { CHECKOUT_STORAGE_KEY, clearCheckoutDraft } from "@/lib/checkout-draft";
import { clearCart } from "@/lib/cart";
import { setCartDrawerOpen } from "@/lib/cart-drawer";

jest.mock("next/navigation", () => ({
  usePathname: () => "/checkout",
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
  isDefaultShipping: false,
};

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
    clearCart();
    clearCheckoutDraft();
    setCartDrawerOpen(false);
    jest.restoreAllMocks();
  });

  it("renders the page heading, both sections, and no later steps", () => {
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
    expect(screen.queryByText(/Shipping method/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: /Payment/ }),
    ).not.toBeInTheDocument();
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

  it("lets a guest complete the form with no account controls", () => {
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
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(
      screen.getByRole("button", { name: "Details saved" }),
    ).toBeInTheDocument();
  });

  it("shows a specific message for every required field left blank", () => {
    render(
      <CheckoutView
        customer={null}
        savedAddresses={[]}
        countryOptions={countryOptions}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

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
    expect(screen.getByText("Check 8 fields below.")).toBeInTheDocument();
  });

  it("clears a field's message once it is filled and resubmitted", () => {
    render(
      <CheckoutView
        customer={null}
        savedAddresses={[]}
        countryOptions={countryOptions}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("Enter your first name.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("First name"), {
      target: { value: "Jamie" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

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
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

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
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(
      screen.getByText("Enter the billing street address."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Details saved" }),
    ).not.toBeInTheDocument();
  });

  it("renders the saved-address picker for a customer with addresses and fills the fields on selection", () => {
    render(
      <CheckoutView
        customer={customer}
        savedAddresses={[savedAddress]}
        countryOptions={countryOptions}
      />,
    );

    fireEvent.click(
      screen.getByRole("radio", {
        name: "123 Maple Street, Springfield, IL 62704",
      }),
    );

    expect(screen.getByLabelText("Street address")).toHaveValue(
      "123 Maple Street",
    );
    expect(screen.getByLabelText("City")).toHaveValue("Springfield");
    expect(screen.getByLabelText("State")).toHaveValue("IL");
    expect(screen.getByLabelText("ZIP code")).toHaveValue("62704");
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

  it("submits as a real button described by the payment note, with no navigation", () => {
    render(
      <CheckoutView
        customer={null}
        savedAddresses={[]}
        countryOptions={countryOptions}
      />,
    );

    const button = screen.getByRole("button", { name: "Continue" });
    expect(button).toHaveAttribute("type", "submit");
    expect(button.tagName).toBe("BUTTON");
    expect(button.getAttribute("aria-describedby")).toBe(
      "checkout-payment-note",
    );

    fillValidForm();
    fireEvent.click(button);

    expect(
      screen.getByText(/Your details are saved on this device/),
    ).toBeInTheDocument();
  });

  it("posts the mapped address once when the save checkbox is checked", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 201 });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <CheckoutView
        customer={customer}
        savedAddresses={[]}
        countryOptions={countryOptions}
      />,
    );

    fillValidForm();
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Save this address to my account" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/checkout/addresses");
    expect(JSON.parse(init!.body as string)).toMatchObject({
      firstName: "Jamie",
      lastName: "Rivera",
      address1: "123 Maple Street",
      city: "Springfield",
      state: "IL",
      postalCode: "62704",
    });
  });

  it("shows a non-blocking notice and still completes when the save request fails", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 502 }) as unknown as typeof fetch;

    render(
      <CheckoutView
        customer={customer}
        savedAddresses={[]}
        countryOptions={countryOptions}
      />,
    );

    fillValidForm();
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Save this address to my account" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(
      screen.getByRole("button", { name: "Details saved" }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByText(/We couldn't save this address/),
      ).toBeInTheDocument(),
    );
  });

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
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
