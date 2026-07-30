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
  it("renders every address control", () => {
    renderFields();

    expect(screen.getByLabelText("Street address")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Apt, suite, etc. (optional)"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("City")).toBeInTheDocument();
    expect(screen.getByLabelText("State")).toBeInTheDocument();
    expect(screen.getByLabelText("ZIP code")).toBeInTheDocument();
    expect(screen.getByLabelText("Country")).toBeInTheDocument();
    expect(
      screen.getByText("Billing address is the same as delivery"),
    ).toBeInTheDocument();
  });

  it("sets the right autocomplete token on each field", () => {
    renderFields();

    expect(screen.getByLabelText("Street address")).toHaveAttribute(
      "autocomplete",
      "address-line1",
    );
    expect(
      screen.getByLabelText("Apt, suite, etc. (optional)"),
    ).toHaveAttribute("autocomplete", "address-line2");
    expect(screen.getByLabelText("City")).toHaveAttribute(
      "autocomplete",
      "address-level2",
    );
    expect(screen.getByLabelText("State")).toHaveAttribute(
      "autocomplete",
      "address-level1",
    );
    expect(screen.getByLabelText("ZIP code")).toHaveAttribute(
      "autocomplete",
      "postal-code",
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
    expect(hiddenSelect).toHaveAttribute("autocomplete", "country");
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
});
