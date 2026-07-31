import { fireEvent, render, screen } from "@testing-library/react";

import { SavedAddressPicker } from "@/components";
import { NEW_ADDRESS_ID, type SavedAddress } from "@/lib/saved-address";

function makeAddress(overrides: Partial<SavedAddress> = {}): SavedAddress {
  return {
    id: "caddr_1",
    label: "123 Maple Street, Springfield, IL 62704",
    addressName: "",
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
    ...overrides,
  };
}

describe("SavedAddressPicker", () => {
  it("renders nothing for an empty address list", () => {
    const { container } = render(
      <SavedAddressPicker addresses={[]} selectedId="" onSelect={jest.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders one radio per address plus an entry to add a new one", () => {
    render(
      <SavedAddressPicker
        addresses={[
          makeAddress(),
          makeAddress({ id: "caddr_2", label: "Other" }),
        ]}
        selectedId=""
        onSelect={jest.fn()}
      />,
    );

    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(
      screen.getByRole("radio", { name: "Enter a new address" }),
    ).toBeInTheDocument();
  });

  it("names the group", () => {
    render(
      <SavedAddressPicker
        addresses={[makeAddress()]}
        selectedId=""
        onSelect={jest.fn()}
      />,
    );

    expect(
      screen.getByRole("radiogroup", { name: "Use a saved address" }),
    ).toBeInTheDocument();
  });

  it("reports the selected address id", () => {
    const onSelect = jest.fn();
    render(
      <SavedAddressPicker
        addresses={[makeAddress()]}
        selectedId=""
        onSelect={onSelect}
      />,
    );

    fireEvent.click(
      screen.getByRole("radio", {
        name: "123 Maple Street, Springfield, IL 62704",
      }),
    );

    expect(onSelect).toHaveBeenCalledWith("caddr_1");
  });

  it("reports the new-address sentinel for 'Enter a new address'", () => {
    const onSelect = jest.fn();
    render(
      <SavedAddressPicker
        addresses={[makeAddress()]}
        selectedId="caddr_1"
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: "Enter a new address" }));

    expect(onSelect).toHaveBeenCalledWith(NEW_ADDRESS_ID);
  });

  it("checks the pre-selected address", () => {
    render(
      <SavedAddressPicker
        addresses={[makeAddress()]}
        selectedId="caddr_1"
        onSelect={jest.fn()}
      />,
    );

    expect(
      screen.getByRole("radio", {
        name: "123 Maple Street, Springfield, IL 62704",
      }),
    ).toBeChecked();
  });
});
