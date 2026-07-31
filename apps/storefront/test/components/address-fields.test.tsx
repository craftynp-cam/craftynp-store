import { fireEvent, render, screen } from "@testing-library/react";

import { AddressFields } from "@/components";
import { EMPTY_CHECKOUT_DRAFT } from "@/lib/checkout";

const countryOptions = [
  { id: "us", label: "United States" },
  { id: "ca", label: "Canada" },
];

function renderFields(
  overrides: Partial<Parameters<typeof AddressFields>[0]> = {},
) {
  const onChange = jest.fn();
  render(
    <AddressFields
      values={EMPTY_CHECKOUT_DRAFT}
      errors={{}}
      onChange={onChange}
      countryOptions={countryOptions}
      {...overrides}
    />,
  );
  return { onChange };
}

describe("AddressFields", () => {
  it("sets the right autocomplete token on each field", () => {
    renderFields();

    expect(screen.getByLabelText("Street address")).toHaveAttribute(
      "autocomplete",
      "shipping address-line1",
    );
    expect(
      screen.getByLabelText("Apt, suite, etc. (optional)"),
    ).toHaveAttribute("autocomplete", "shipping address-line2");
    expect(screen.getByLabelText("City")).toHaveAttribute(
      "autocomplete",
      "shipping address-level2",
    );
    expect(screen.getByLabelText("State")).toHaveAttribute(
      "autocomplete",
      "shipping address-level1",
    );
    expect(screen.getByLabelText("ZIP code")).toHaveAttribute(
      "autocomplete",
      "shipping postal-code",
    );
  });

  it("uses a text ZIP input with a numeric input mode, not a number input", () => {
    renderFields();
    const zipInput = screen.getByLabelText("ZIP code");
    expect(zipInput).toHaveAttribute("inputmode", "numeric");
    expect(zipInput).toHaveAttribute("type", "text");
  });

  it("gives the country select the country autocomplete token and a name", () => {
    renderFields();

    const hiddenSelect = document.querySelector("select");
    expect(hiddenSelect).toHaveAttribute("autocomplete", "shipping country");
    expect(hiddenSelect).toHaveAttribute("name", "country");
  });

  it("renders the passed country options", () => {
    renderFields();

    fireEvent.click(screen.getByLabelText("Country"));
    expect(screen.getByRole("option", { name: "Canada" })).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "United States" }),
    ).toBeInTheDocument();
  });

  it("reports a lowercased country code on selection", () => {
    const { onChange } = renderFields();

    fireEvent.click(screen.getByLabelText("Country"));
    fireEvent.click(screen.getByRole("option", { name: "Canada" }));

    expect(onChange).toHaveBeenCalledWith({ countryCode: "ca" });
  });

  it("defaults the billing checkbox to checked", () => {
    renderFields();
    expect(
      screen.getByRole("checkbox", {
        name: "Billing address is the same as delivery",
      }),
    ).toBeChecked();
  });

  it("reports toggling the billing checkbox", () => {
    const { onChange } = renderFields();

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Billing address is the same as delivery",
      }),
    );

    expect(onChange).toHaveBeenCalledWith({ billingSameAsDelivery: false });
  });

  it("marks a field invalid and shows its error message", () => {
    renderFields({ errors: { city: "Enter your city." } });

    expect(screen.getByLabelText("City")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByText("Enter your city.")).toBeInTheDocument();
  });

  it("does not render billing fields while the checkbox is checked", () => {
    renderFields();
    expect(screen.queryByLabelText("Billing Street address")).toBeNull();
  });

  it("unfurls a billing address block when the checkbox is unchecked", () => {
    renderFields({
      values: { ...EMPTY_CHECKOUT_DRAFT, billingSameAsDelivery: false },
    });

    expect(
      screen.getByRole("heading", { name: "Billing address" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Billing Street address")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Billing Apt, suite, etc. (optional)"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Billing City")).toBeInTheDocument();
    expect(screen.getByLabelText("Billing State")).toBeInTheDocument();
    expect(screen.getByLabelText("Billing ZIP code")).toBeInTheDocument();
    expect(screen.getByLabelText("Billing Country")).toBeInTheDocument();
  });

  it("scopes the billing fields' autocomplete tokens to billing", () => {
    renderFields({
      values: { ...EMPTY_CHECKOUT_DRAFT, billingSameAsDelivery: false },
    });

    expect(screen.getByLabelText("Billing Street address")).toHaveAttribute(
      "autocomplete",
      "billing address-line1",
    );
  });

  it("reports a billing patch under billing-prefixed keys", () => {
    const { onChange } = renderFields({
      values: { ...EMPTY_CHECKOUT_DRAFT, billingSameAsDelivery: false },
    });

    fireEvent.change(screen.getByLabelText("Billing City"), {
      target: { value: "Portland" },
    });

    expect(onChange).toHaveBeenCalledWith({ billingCity: "Portland" });
  });

  it("marks a billing field invalid from its own error key", () => {
    renderFields({
      values: { ...EMPTY_CHECKOUT_DRAFT, billingSameAsDelivery: false },
      errors: { billingCity: "Enter the billing city." },
    });

    expect(screen.getByLabelText("Billing City")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByText("Enter the billing city.")).toBeInTheDocument();
  });
});
